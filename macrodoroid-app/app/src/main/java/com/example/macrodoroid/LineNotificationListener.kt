package com.example.macrodoroid

import android.app.Notification
import android.content.Context
import android.content.SharedPreferences
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.telephony.SmsManager

class LineNotificationListener : NotificationListenerService() {

    companion object {
        const val LINE_PACKAGE = "jp.naver.line.android"
        const val PREFS_NAME = "macrodoroid_prefs"
        const val KEY_PHONE_NUMBER = "phone_number"
        const val KEY_ENABLED = "enabled"
    }

    private lateinit var prefs: SharedPreferences

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName != LINE_PACKAGE) return
        if (!prefs.getBoolean(KEY_ENABLED, false)) return

        val phoneNumber = prefs.getString(KEY_PHONE_NUMBER, null) ?: return

        val extras = sbn.notification.extras
        val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""

        val message = if (title.isNotEmpty()) "[$title] $text" else text
        if (message.isBlank()) return

        try {
            val smsManager = SmsManager.getDefault()
            val parts = smsManager.divideMessage(message)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
