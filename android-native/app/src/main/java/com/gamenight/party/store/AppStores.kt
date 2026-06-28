package com.gamenight.party.store

import android.content.Context
import androidx.compose.runtime.staticCompositionLocalOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * The three persisted app-shell stores, built once and shared process-wide. The host creates this
 * (e.g. in MainActivity) and provides it via [LocalAppStores]; navigation then reads the slice each
 * screen needs.
 */
class AppStores(
    val settings: SettingsStore,
    val roster: RosterStore,
    val leaderboard: LeaderboardStore,
) {
    companion object {
        /**
         * Build all stores over the shared [Context.gameNightDataStore]. [scope] should outlive the
         * UI (it backs the eagerly-shared state flows); the default is a process-lifetime scope.
         */
        fun create(
            context: Context,
            scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
        ): AppStores {
            val dataStore = context.applicationContext.gameNightDataStore
            return AppStores(
                settings = SettingsStore(dataStore, scope),
                roster = RosterStore(dataStore, scope),
                leaderboard = LeaderboardStore(dataStore, scope),
            )
        }
    }
}

/** Provides the [AppStores] to the composable tree; throws if read before the host provides it. */
val LocalAppStores = staticCompositionLocalOf<AppStores> {
    error("AppStores not provided — wrap the app in CompositionLocalProvider(LocalAppStores provides …)")
}
