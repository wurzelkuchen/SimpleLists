package com.example

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

/**
 * Manages notification channels, immediate notifications, and background scheduled reminders.
 */
object NotificationHelper {
    private const val TAG = "NotificationHelper"
    const val CHANNEL_ID = "simple_lists_reminders"
    const val CHANNEL_NAME = "Task Reminders & Deadlines"
    private const val PREFS_NAME = "scheduled_notifications_prefs"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for task deadlines, reminders, and list updates"
                enableVibration(true)
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    @SuppressLint("MissingPermission")
    fun showNotification(
        context: Context,
        id: Int,
        title: String,
        message: String,
        payload: String? = null
    ) {
        createNotificationChannel(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("notification_id", id)
            if (payload != null) {
                putExtra("notification_payload", payload)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        try {
            NotificationManagerCompat.from(context).notify(id, builder.build())
        } catch (e: SecurityException) {
            Log.e(TAG, "Notification permission not granted: ${e.message}")
        }
    }

    fun scheduleNotification(
        context: Context,
        id: Int,
        title: String,
        message: String,
        triggerAtMillis: Long,
        payload: String? = null
    ) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return

        val intent = Intent(context, NotificationReceiver::class.java).apply {
            putExtra("notification_id", id)
            putExtra("notification_title", title)
            putExtra("notification_message", message)
            if (payload != null) {
                putExtra("notification_payload", payload)
            }
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            }

            // Persist reminder so we can restore after device reboot
            saveScheduledReminder(context, id, title, message, triggerAtMillis, payload)
            Log.d(TAG, "Scheduled reminder id=$id at $triggerAtMillis")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule notification: ${e.message}", e)
        }
    }

    fun cancelNotification(context: Context, id: Int) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        val intent = Intent(context, NotificationReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_NO_CREATE or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )
        if (pendingIntent != null && alarmManager != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }

        NotificationManagerCompat.from(context).cancel(id)
        removeScheduledReminder(context, id)
        Log.d(TAG, "Cancelled notification id=$id")
    }

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private fun saveScheduledReminder(
        context: Context,
        id: Int,
        title: String,
        message: String,
        triggerAtMillis: Long,
        payload: String?
    ) {
        val json = JSONObject().apply {
            put("id", id)
            put("title", title)
            put("message", message)
            put("triggerAtMillis", triggerAtMillis)
            put("payload", payload ?: "")
        }
        getPrefs(context).edit().putString(id.toString(), json.toString()).apply()
    }

    fun removeScheduledReminder(context: Context, id: Int) {
        getPrefs(context).edit().remove(id.toString()).apply()
    }

    fun rescheduleAllOnBoot(context: Context) {
        val prefs = getPrefs(context)
        val now = System.currentTimeMillis()
        val allEntries = prefs.all
        for ((_, value) in allEntries) {
            try {
                val jsonStr = value as? String ?: continue
                val json = JSONObject(jsonStr)
                val triggerAt = json.optLong("triggerAtMillis", 0L)
                val id = json.optInt("id", 0)
                val title = json.optString("title", "")
                val message = json.optString("message", "")
                val payload = json.optString("payload", "").ifEmpty { null }

                if (triggerAt > now) {
                    scheduleNotification(context, id, title, message, triggerAt, payload)
                } else {
                    removeScheduledReminder(context, id)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to restore reminder: ${e.message}")
            }
        }
    }
}
