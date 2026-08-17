package io.github.tejasnafde.macremote.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase

class LegacyStorageReader(private val context: Context) {
    fun read(key: String): String? {
        val candidates = listOf(
            Triple("AsyncStorage", "Storage", "key" to "value"),
            Triple("RKStorage", "catalystLocalStorage", "key" to "value"),
        )
        for ((database, table, columns) in candidates) {
            val file = context.getDatabasePath(database)
            if (!file.exists()) continue
            val value = runCatching {
                SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY).use { db ->
                    db.query(
                        table,
                        arrayOf(columns.second),
                        "`${columns.first}` = ?",
                        arrayOf(key),
                        null,
                        null,
                        null,
                        "1",
                    ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
                }
            }.getOrNull()
            if (value != null) return value
        }
        return null
    }
}
