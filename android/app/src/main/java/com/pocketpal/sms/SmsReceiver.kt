package com.pocketpal.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            for (sms in messages) {
                val address = sms.originatingAddress ?: ""
                val body = sms.messageBody ?: ""
                val timestamp = sms.timestampMillis

                Log.d("SmsReceiver", "Received SMS")

                val reactContext = SmsModule.getReactContext()

                if (reactContext != null) {
                    val params = Arguments.createMap()
                    params.putString("address", address)
                    params.putString("body", body)
                    params.putDouble("date", timestamp.toDouble())
                    params.putInt("type", 1) // 1 = Inbox

                    reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onSmsReceived", params)
                }
            }
        }
    }
}
