import com.android.build.gradle.tasks.MergeSourceSetFolders
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Name build artifacts properly: GameNight-1.0-debug.apk / GameNight-1.0-release.apk
// (instead of the default app-debug.apk).
base {
    archivesName.set("GameNight-1.0")
}

// Release signing — credentials come from a gitignored keystore.properties (never committed).
// If that file is absent (fresh clone / CI without secrets), release builds just stay unsigned.
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

android {
    namespace = "com.gamenight.party"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.gamenight.party"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            if (keystorePropsFile.exists()) {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Signed for trusted sideloading. Minification stays OFF for now so the release build
            // behaves exactly like the verified debug build; R8 (with the Compose/serialization
            // keep-rules in proguard-rules.pro) can be enabled later once test-verified on a device.
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePropsFile.exists()) signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
    }
    // The generated shared-content tree (see syncSharedContent) is mounted as an asset source,
    // so the canonical web JSON ships inside the APK without committing a second copy.
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/sharedContent"))
}

kotlin {
    // Compile with whatever JDK runs Gradle (Android Studio's JBR is 21 here) but emit JVM-17
    // bytecode. Avoids jvmToolchain(17), which would require a separately-installed JDK 17.
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

// ─────────────────────────  Shared content pipeline  ─────────────────────────
// The web app (../src/games/*/content/*.json) is the single source of truth for game content
// (~2,000 bilingual items). This task mirrors those JSON files into the native app's assets at
// build time and emits a manifest.json index. Edit content once in the web tree; both apps get it.
val webRepoRoot: File = rootProject.projectDir.parentFile // D:\Social Games Webapp
val webGamesDir: File = File(webRepoRoot, "src/games")
val sharedContentDir = layout.buildDirectory.dir("generated/sharedContent")

val syncSharedContent by tasks.registering {
    group = "content"
    description = "Mirror canonical web content JSON into app assets (single source of truth shared with the webapp)."
    val outRoot = sharedContentDir
    inputs.dir(webGamesDir).withPropertyName("webGames")
    // Bump when the 18+ exclusion rules below change, so Gradle re-runs instead of serving cached assets.
    inputs.property("filterRevision", "v3-strip-18plus-items")
    outputs.dir(outRoot)
    doLast {
        val contentRoot = outRoot.get().asFile.resolve("content")
        contentRoot.deleteRecursively()
        contentRoot.mkdirs()

        // 18+ content is stripped from the NATIVE build only (the web app keeps everything). Per the
        // user's decision: remove Truth or Dare "Extreme", Never Have I Ever "Wild", Would You
        // Rather "Risky". Whole-file exclusions drop the file; intensity exclusions filter array items.
        val excludedFiles = setOf("never-have-i-ever/statements.wild.json")
        val strippedIntensities = mapOf(
            "truth-or-dare" to setOf("extreme"),
            "would-you-rather" to setOf("risky"),
        )
        val slurper = groovy.json.JsonSlurper()

        val manifest = linkedMapOf<String, List<String>>()
        webGamesDir.listFiles()
            ?.filter { it.isDirectory }
            ?.sortedBy { it.name }
            ?.forEach { gameDir ->
                val game = gameDir.name
                val contentDir = gameDir.resolve("content")
                if (!contentDir.isDirectory) return@forEach
                val jsons = contentDir.listFiles { f -> f.isFile && f.extension == "json" }
                    ?.sortedBy { it.name }.orEmpty()
                if (jsons.isEmpty()) return@forEach
                val dest = contentRoot.resolve(game).apply { mkdirs() }
                val strip = strippedIntensities[game]
                val kept = mutableListOf<String>()
                jsons.forEach inner@{ src ->
                    if ("$game/${src.name}" in excludedFiles) return@inner // drop whole 18+ file
                    val target = dest.resolve(src.name)
                    val parsed = if (strip != null) slurper.parse(src, "UTF-8") else null
                    val keep = { item: Any? ->
                        val tier = (item as? Map<*, *>)?.get("intensity") as? String
                        tier == null || strip?.contains(tier) != true
                    }
                    when {
                        // Top-level array of items.
                        strip != null && parsed is List<*> ->
                            target.writeText(groovy.json.JsonOutput.toJson(parsed.filter(keep)), Charsets.UTF_8)
                        // Wrapped deck object { ..., "items": [...] } (Truth or Dare, Would You Rather).
                        strip != null && parsed is Map<*, *> && parsed["items"] is List<*> -> {
                            @Suppress("UNCHECKED_CAST")
                            val map = parsed as MutableMap<String, Any?>
                            map["items"] = (map["items"] as List<*>).filter(keep)
                            target.writeText(groovy.json.JsonOutput.toJson(map), Charsets.UTF_8)
                        }
                        else -> src.copyTo(target, overwrite = true)
                    }
                    kept += src.name
                }
                if (kept.isEmpty()) dest.delete() else manifest[game] = kept
            }
        val json = buildString {
            append("{\n")
            manifest.entries.forEachIndexed { i, (game, files) ->
                append("  \"").append(game).append("\": [")
                append(files.joinToString(", ") { "\"$it\"" })
                append(if (i < manifest.size - 1) "],\n" else "]\n")
            }
            append("}\n")
        }
        contentRoot.resolve("manifest.json").writeText(json)
        logger.lifecycle(
            "syncSharedContent: ${manifest.size} games, " +
                "${manifest.values.sumOf { it.size }} content files -> $contentRoot (18+ stripped)",
        )
    }
}

tasks.named("preBuild").configure { dependsOn(syncSharedContent) }
tasks.withType<MergeSourceSetFolders>().configureEach { dependsOn(syncSharedContent) }

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android) // CoroutineScope/Dispatchers/flow used directly by stores + screens
    implementation(libs.androidx.datastore.preferences) // persisted roster / settings / leaderboard

    debugImplementation(libs.androidx.ui.tooling)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
}
