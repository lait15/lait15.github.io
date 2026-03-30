package com.example.macrodoroid

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    companion object {
        const val PREFS_NAME = "macrodoroid_prefs"
        const val KEY_PHONE_NUMBERS = "phone_numbers"
        const val KEY_ENABLED = "enabled"
        const val SEPARATOR = ","
    }

    private lateinit var prefs: SharedPreferences
    private lateinit var etPhoneNumber: EditText
    private lateinit var btnAddNumber: Button
    private lateinit var llPhoneList: LinearLayout
    private lateinit var switchEnabled: Switch
    private lateinit var btnNotificationAccess: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        etPhoneNumber = findViewById(R.id.etPhoneNumber)
        btnAddNumber = findViewById(R.id.btnAddNumber)
        llPhoneList = findViewById(R.id.llPhoneList)
        switchEnabled = findViewById(R.id.switchEnabled)
        btnNotificationAccess = findViewById(R.id.btnNotificationAccess)

        btnNotificationAccess.setOnClickListener {
            startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"))
        }

        btnAddNumber.setOnClickListener {
            val number = etPhoneNumber.text.toString().trim()
            if (number.isEmpty()) {
                Toast.makeText(this, "番号を入力してください", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val numbers = getPhoneNumbers().toMutableSet()
            if (numbers.contains(number)) {
                Toast.makeText(this, "すでに登録されています", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            numbers.add(number)
            savePhoneNumbers(numbers)
            etPhoneNumber.text.clear()
            refreshPhoneList()
        }

        switchEnabled.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked && getPhoneNumbers().isEmpty()) {
                switchEnabled.isChecked = false
                Toast.makeText(this, "先に転送先の番号を追加してください", Toast.LENGTH_SHORT).show()
                return@setOnCheckedChangeListener
            }
            prefs.edit().putBoolean(KEY_ENABLED, isChecked).apply()
        }

        refreshPhoneList()
        switchEnabled.isChecked = prefs.getBoolean(KEY_ENABLED, false)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.SEND_SMS), 100)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 100 && grantResults.firstOrNull() != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "SMS送信の権限が必要です。設定から許可してください。", Toast.LENGTH_LONG).show()
        }
    }

    private fun getPhoneNumbers(): Set<String> {
        val raw = prefs.getString(KEY_PHONE_NUMBERS, "") ?: ""
        return if (raw.isEmpty()) emptySet() else raw.split(SEPARATOR).toSet()
    }

    private fun savePhoneNumbers(numbers: Set<String>) {
        prefs.edit().putString(KEY_PHONE_NUMBERS, numbers.joinToString(SEPARATOR)).apply()
    }

    private fun refreshPhoneList() {
        llPhoneList.removeAllViews()
        val numbers = getPhoneNumbers()
        if (numbers.isEmpty()) {
            val tv = TextView(this)
            tv.text = "（未登録）"
            tv.setTextColor(0xFF6E6E73.toInt())
            llPhoneList.addView(tv)
            return
        }
        for (number in numbers) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
            }
            val tv = TextView(this).apply {
                text = number
                textSize = 16f
                setTextColor(0xFF1D1D1F.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val btn = Button(this).apply {
                text = "削除"
                setOnClickListener {
                    val updated = getPhoneNumbers().toMutableSet()
                    updated.remove(number)
                    savePhoneNumbers(updated)
                    refreshPhoneList()
                }
            }
            row.addView(tv)
            row.addView(btn)
            llPhoneList.addView(row)
        }
    }
}
