package com.example

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class NotificationReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "NotificationReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d(TAG, "Boot completed, rescheduling reminders")
            NotificationHelper.rescheduleAllOnBoot(context)
            return
        }

        val id = intent.getIntExtra("notification_id", 0)
        val title = intent.getStringExtra("notification_title") ?: "Reminder"
        val message = intent.getStringExtra("notification_message") ?: ""
        val payload = intent.getStringExtra("notification_payload")

        Log.d(TAG, "Firing scheduled notification id=$id: $title")
        NotificationHelper.showNotification(context, id, title, message, payload)
        NotificationHelper.removeScheduledReminder(context, id)
    }
}
