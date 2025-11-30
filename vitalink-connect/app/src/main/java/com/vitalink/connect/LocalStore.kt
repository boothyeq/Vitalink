package com.vitalink.connect

import android.content.Context
import androidx.room.Database
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

@Entity(tableName = "pending_steps")
data class PendingSteps(
    @PrimaryKey val recordUid: String,
    val patientId: String,
    val originId: String,
    val deviceId: String,
    val startTs: String,
    val endTs: String,
    val count: Long,
    val tzOffsetMin: Int
)

@Entity(tableName = "pending_hr")
data class PendingHr(
    @PrimaryKey val recordUid: String,
    val patientId: String,
    val originId: String,
    val deviceId: String,
    val timeTs: String,
    val bpm: Long,
    val tzOffsetMin: Int
)

@Entity(tableName = "pending_spo2")
data class PendingSpo2(
    @PrimaryKey val recordUid: String,
    val patientId: String,
    val originId: String,
    val deviceId: String,
    val timeTs: String,
    val spo2Pct: Double,
    val tzOffsetMin: Int
)

@Entity(tableName = "pending_distance")
data class PendingDistance(
    @PrimaryKey val recordUid: String,
    val patientId: String,
    val originId: String,
    val deviceId: String,
    val startTs: String,
    val endTs: String,
    val meters: Long,
    val tzOffsetMin: Int
)

@Dao
interface PendingDao {
    @Insert
    suspend fun insertSteps(item: PendingSteps)

    @Insert
    suspend fun insertHr(item: PendingHr)

    @Insert
    suspend fun insertSpo2(item: PendingSpo2)

    @Insert
    suspend fun insertDistance(item: PendingDistance)

    @Query("SELECT * FROM pending_steps LIMIT :limit")
    suspend fun getSteps(limit: Int = 500): List<PendingSteps>

    @Query("SELECT * FROM pending_hr LIMIT :limit")
    suspend fun getHr(limit: Int = 1000): List<PendingHr>

    @Query("SELECT * FROM pending_spo2 LIMIT :limit")
    suspend fun getSpo2(limit: Int = 1000): List<PendingSpo2>

    @Query("SELECT * FROM pending_distance LIMIT :limit")
    suspend fun getDistance(limit: Int = 500): List<PendingDistance>

    @Query("DELETE FROM pending_steps WHERE recordUid IN (:uids)")
    suspend fun deleteSteps(uids: List<String>)

    @Query("DELETE FROM pending_hr WHERE recordUid IN (:uids)")
    suspend fun deleteHr(uids: List<String>)

    @Query("DELETE FROM pending_spo2 WHERE recordUid IN (:uids)")
    suspend fun deleteSpo2(uids: List<String>)

    @Query("DELETE FROM pending_distance WHERE recordUid IN (:uids)")
    suspend fun deleteDistance(uids: List<String>)
}

@Database(entities = [PendingSteps::class, PendingHr::class, PendingSpo2::class, PendingDistance::class], version = 2, exportSchema = false)
abstract class LocalDb : RoomDatabase() {
    abstract fun dao(): PendingDao

    companion object {
        @Volatile private var INSTANCE: LocalDb? = null
        fun get(context: Context): LocalDb = INSTANCE ?: synchronized(this) {
            val inst = Room.databaseBuilder(context.applicationContext, LocalDb::class.java, "vitalink_local").fallbackToDestructiveMigration().build()
            INSTANCE = inst
            inst
        }
    }
}
