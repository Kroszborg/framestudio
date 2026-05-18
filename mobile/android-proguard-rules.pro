# ── React Native core ─────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.proguard.annotations.DoNotStrip { *; }
-keep class com.facebook.proguard.annotations.DoNotStripAny { *; }
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keep @com.facebook.proguard.annotations.DoNotStripAny class * { *; }
-keepclassmembers,allowobfuscation class * {
  @com.facebook.proguard.annotations.DoNotStrip *;
  @com.facebook.proguard.annotations.DoNotStripAny *;
}

# ── Hermes JS engine (bytecode) ───────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.hermes.intl.** { *; }

# ── Expo modules ──────────────────────────────────────────────────────────────
-keep class expo.modules.** { *; }
-keep class expo.** { *; }

# ── Expo Video Processor (our native module) ──────────────────────────────────
-keep class expo.modules.videoprocessor.** { *; }

# ── MediaPipe (background removal) ───────────────────────────────────────────
-keep class com.google.mediapipe.** { *; }
-dontwarn com.google.mediapipe.**

# ── OkHttp + Retrofit (networking) ───────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn okhttp3.**
-dontwarn okio.**

# ── Keep stack traces readable in crash reports ───────────────────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Android standard ──────────────────────────────────────────────────────────
-keep class * implements android.os.Parcelable {
  public static final android.os.Parcelable$Creator *;
}
-keepclassmembers class * extends android.content.Context {
  public void *(android.view.View);
  public void *(android.view.MenuItem);
}

# ── Kotlin ─────────────────────────────────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings {
  <fields>;
}
-keepclassmembers class kotlin.Lazy {
  <fields>;
}

# ── Suppress common warnings ──────────────────────────────────────────────────
-dontwarn com.facebook.**
-dontwarn javax.annotation.**
-dontwarn sun.misc.Unsafe
