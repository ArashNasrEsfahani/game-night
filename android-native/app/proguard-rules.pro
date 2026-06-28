# kotlinx.serialization: keep generated serializers for our @Serializable models.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers @kotlinx.serialization.Serializable class ** {
    *** Companion;
    *** INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.gamenight.party.**$$serializer { *; }
-keep class com.gamenight.party.**$Companion { *; }
