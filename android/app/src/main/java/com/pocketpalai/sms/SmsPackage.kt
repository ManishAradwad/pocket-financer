package com.pocketpal.sms

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.pocketpal.specs.NativeSmsModuleSpec

class SmsPackage : TurboReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == NativeSmsModuleSpec.NAME) {
            SmsModule(reactContext)
        } else {
            null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            val moduleInfos = mutableMapOf<String, ReactModuleInfo>()
            val isTurboModule = true
            moduleInfos[NativeSmsModuleSpec.NAME] = ReactModuleInfo(
                NativeSmsModuleSpec.NAME,
                NativeSmsModuleSpec.NAME,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                true, // hasConstants
                false, // isCxxModule
                isTurboModule
            )
            moduleInfos
        }
    }
}
