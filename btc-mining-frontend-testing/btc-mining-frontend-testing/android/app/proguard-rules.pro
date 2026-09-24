# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Google Mobile Ads SDK
-keep public class com.google.android.gms.ads.** {
    public *;
}
-keep public class com.google.ads.** {
    public *;
}
-dontwarn com.google.android.gms.ads.*

# InMobi mediation adapter pulls in a JaCoCo (code coverage) reference —
# java.lang.instrument.IllegalClassFormatException is a desktop-JVM-only
# class that doesn't exist on Android and isn't actually exercised at
# runtime; R8 8.x fails the build on "missing class" by default unless
# told to ignore it.
-dontwarn org.jacoco.**
-dontwarn java.lang.instrument.**

# Apptrove SDK & Retrofit / Reflection Rules
# R8 previously ran with -dontshrink/-dontoptimize/-dontobfuscate, which left
# minifyEnabled true doing nothing at all -- Play Console reported 6%
# obfuscation and no shrinking. The keep rules below are what make removing them
# safe; add to them rather than reinstating the blanket switches.

# Keep line numbers so crash reports stay readable after obfuscation, but hide
# the original source file names.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# This app's own native modules and packages are looked up reflectively by the
# React Native bridge, so their names must survive.
-keep class com.bitplay.app.** { *; }
-keep class * extends com.facebook.react.ReactPackage { *; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }
-keep class * extends com.facebook.react.uimanager.ViewManager { *; }
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
}

# View props are applied reflectively: this RN version does not generate the
# $$PropsSetter classes it looks for (hence the harmless "Could not find
# generated setter" warnings, which predate minification and appear for core
# classes like LayoutShadowNode). The fallback reads @ReactProp methods by name,
# so those must not be renamed.
-keep class **$$PropsSetter { *; }
-keep,allowobfuscation @interface com.facebook.react.uimanager.annotations.ReactProp
-keep,allowobfuscation @interface com.facebook.react.uimanager.annotations.ReactPropGroup
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Anything reached only from native code cannot be seen by R8's analysis.
-keepclasseswithmembernames class * {
    native <methods>;
}
-keepattributes Signature, InnerClasses, EnclosingMethod, RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations, AnnotationDefault

# Kotlin Coroutines
-keep class kotlin.coroutines.Continuation { *; }
-keep class kotlin.coroutines.jvm.internal.BaseContinuationImpl { *; }

-keep class retrofit2.** { *; }
-keep interface retrofit2.** { *; }
-keepclassmembers class retrofit2.** { *; }
-keepclassmembers interface * {
    @retrofit2.http.* <methods>;
}
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-keep class retrofit2.Response { *; }
-keep class retrofit2.Call { *; }
-dontwarn retrofit2.**

-keep class com.apptrove.** { *; }
-keep class com.apptrove.sdk.** { *; }
-keep interface com.apptrove.** { *; }
-keep interface com.apptrove.sdk.** { *; }
-keepclassmembers class com.apptrove.** { *; }
-keepclassmembers class com.apptrove.sdk.** { *; }

-keep class com.trackier.** { *; }
-keep interface com.trackier.** { *; }
-keepclassmembers class com.trackier.** { *; }

-keep class com.google.gson.** { *; }
-keep class com.google.gson.reflect.** { *; }
-keep class com.google.android.gms.common.ConnectionResult {
    int SUCCESS;
}
-keep class com.google.android.gms.ads.identifier.AdvertisingIdClient {
    com.google.android.gms.ads.identifier.AdvertisingIdClient$Info getAdvertisingIdInfo(android.content.Context);
}
-keep class com.google.android.gms.ads.identifier.AdvertisingIdClient$Info {
    java.lang.String getId();
    boolean isLimitAdTrackingEnabled();
}
-keep public class com.android.installreferrer.** { *; }

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.**

# RevenueCat
-keep class com.revenuecat.purchases.** { *; }

# Firebase / FCM
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# React Native MMKV
-keep class com.mrousavy.mmkv.** { *; }

# OkHttp (networking)
-dontwarn okhttp3.**
-dontwarn okio.**

# Missing optional dependencies referenced by Google Tink (used by Firebase/RevenueCat)
-dontwarn com.google.api.client.**
-dontwarn org.joda.time.**
-dontwarn com.google.crypto.tink.**