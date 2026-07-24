package com.gamenight.party.store

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.serialization.json.Json

/**
 * The single app-wide Jetpack DataStore (Preferences) instance. Each store keeps its slice of state
 * as one JSON string under its own key — the native mirror of the web's zustand `persist` to idb,
 * where every store also serialised its partialized state to a single JSON blob.
 *
 * Accessed via the application [Context] so a single instance is shared process-wide.
 */
val Context.gameNightDataStore: DataStore<Preferences> by preferencesDataStore(name = "gamenight")

/**
 * Shared, lenient JSON used by every store to (de)serialise its persisted blob.
 *  • [Json.ignoreUnknownKeys] — tolerate fields added by newer app versions.
 *  • [Json.encodeDefaults] — always write defaults so a blob fully describes the state.
 */
internal val storeJson: Json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    isLenient = true
}
