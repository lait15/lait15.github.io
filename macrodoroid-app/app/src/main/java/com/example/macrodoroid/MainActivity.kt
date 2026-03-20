package com.example.macrodoroid

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract
import android.widget.Button
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    companion object {
        const val REQUEST_PICK_CONTACT = 1
        const val PREFS_NAME = "macrodoroid_prefs"
        const val KEY_PHONE_NUMBER = "phone_number"
        const val KEY_ENABLED = "enabled"
    }

    private lateinit var prefs: SharedPreferences
    private lateinit var tvPhoneNumber: TextView
    private lateinit var switchEnabled: Switch
    private lateinit var btnPickContact: Button
    private lateinit var btnNotificationAccess: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        tvPhoneNumber = findViewById(R.id.tvPhoneNumber)
        switchEnabled = findViewById(R.id.switchEnabled)
        btnPickContact = findViewById(R.id.btnPickContact)
        btnNotificationAccess = findViewById(R.id.btnNotificationAccess)

        updateUI()

        btnPickContact.setOnClickListener {
            val intent = Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI)
            startActivityForResult(intent, REQUEST_PICK_CONTACT)
        }

        btnNotificationAccess.setOnClickListener {
            startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"))
        }

        switchEnabled.setOnCheckedChangeListener { _, isChecked ->
            val phoneNumber = prefs.getString(KEY_PHONE_NUMBER, null)
            if (isChecked && phoneNumber == null) {
                switchEnabled.isChecked = false
                Toast.makeText(this, "先に転送先の連絡先を選択してください", Toast.LENGTH_SHORT).show()
                return@setOnCheckedChangeListener
            }
            prefs.edit().putBoolean(KEY_ENABLED, isChecked).apply()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_PICK_CONTACT && resultCode == Activity.RESULT_OK) {
            data?.data?.let { uri ->
                val phone = getPhoneNumber(uri)
                if (phone != null) {
                    prefs.edit().putString(KEY_PHONE_NUMBER, phone).apply()
                    updateUI()
                } else {
                    Toast.makeText(this, "電話番号を取得できませんでした", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun getPhoneNumber(uri: Uri): String? {
        var cursor: Cursor? = null
        return try {
            cursor = contentResolver.query(uri, arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER), null, null, null)
            if (cursor?.moveToFirst() == true) {
                cursor.getString(0)
            } else null
        } finally {
            cursor?.close()
        }
    }

    private fun updateUI() {
        val phone = prefs.getString(KEY_PHONE_NUMBER, null)
        tvPhoneNumber.text = phone ?: "未設定"
        switchEnabled.isChecked = prefs.getBoolean(KEY_ENABLED, false)
    }
}
