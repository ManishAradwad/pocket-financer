package com.pocketpal.sms

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.pocketpal.specs.NativeSmsModuleSpec

@ReactModule(name = NativeSmsModuleSpec.NAME)
class SmsModule(reactContext: ReactApplicationContext) : NativeSmsModuleSpec(reactContext) {

    override fun getName(): String = NativeSmsModuleSpec.NAME

    override fun hasPermissions(promise: Promise) {
        val readPermission = ContextCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.READ_SMS)
        val receivePermission = ContextCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.RECEIVE_SMS)
        promise.resolve(readPermission == PackageManager.PERMISSION_GRANTED && receivePermission == PackageManager.PERMISSION_GRANTED)
    }

    override fun requestPermissions(promise: Promise) {
        // In React Native, requesting permissions natively without managing Activity result is cumbersome.
        // It's strictly recommended to use JS PermissionsAndroid.
        // So this native method just delegates to hasPermissions for fallback, and the TS wrapper will use PermissionsAndroid.
        hasPermissions(promise)
    }

    override fun getSmsByFilter(filter: ReadableMap, promise: Promise) {
        try {
            val minDate = if (filter.hasKey("minDate")) filter.getDouble("minDate").toLong() else 0L
            val maxDate = if (filter.hasKey("maxDate")) filter.getDouble("maxDate").toLong() else Long.MAX_VALUE
            val addressPattern = if (filter.hasKey("addressPattern")) filter.getString("addressPattern") else null
            val limit = if (filter.hasKey("limit")) filter.getInt("limit") else 100
            val offset = if (filter.hasKey("offset")) filter.getInt("offset") else 0

            val uri = Uri.parse("content://sms/inbox")
            val projection = arrayOf("_id", "address", "body", "date", "type")
            
            val selection = "date >= ? AND date <= ?"
            val selectionArgs = arrayOf(minDate.toString(), maxDate.toString())
            val sortOrder = "date DESC"
            
            val cursor = reactApplicationContext.contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)
            val resultList = Arguments.createArray()
            
            cursor?.use {
                if (offset > 0) {
                    it.move(offset)
                }
                var count = 0
                val addressIndex = it.getColumnIndex("address")
                val bodyIndex = it.getColumnIndex("body")
                val dateIndex = it.getColumnIndex("date")
                val typeIndex = it.getColumnIndex("type")

                while (it.moveToNext() && count < limit) {
                    val msgAddress = if (addressIndex >= 0) it.getString(addressIndex) else ""
                    
                    if (!addressPattern.isNullOrEmpty() && msgAddress != null) {
                        try {
                            val regex = addressPattern.toRegex(RegexOption.IGNORE_CASE)
                            if (!regex.containsMatchIn(msgAddress)) {
                                continue
                            }
                        } catch (e: Exception) {
                            // invalid regex, ignore filter
                        }
                    }

                    val msgMap = Arguments.createMap()
                    msgMap.putString("address", msgAddress)
                    msgMap.putString("body", if (bodyIndex >= 0) it.getString(bodyIndex) else "")
                    msgMap.putDouble("date", if (dateIndex >= 0) it.getLong(dateIndex).toDouble() else 0.0)
                    msgMap.putInt("type", if (typeIndex >= 0) it.getInt(typeIndex) else 1)
                    
                    resultList.pushMap(msgMap)
                    count++
                }
            }
            promise.resolve(resultList)
        } catch (e: Exception) {
            Log.e("SmsModule", "Failed to get SMS", e)
            promise.reject("SMS_ERROR", e.message)
        }
    }

    override fun addListener(eventName: String) {
        // Keep: Required for RN built-in Event Emitter Calls
    }

    override fun removeListeners(count: Double) {
        // Keep: Required for RN built-in Event Emitter Calls
    }
}
