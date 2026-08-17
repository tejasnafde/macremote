package io.github.tejasnafde.macremote.state

class ResponseToken internal constructor(
    val deviceId: String,
    val generation: Long,
    val request: Long,
)

class ResponseGate {
    private var deviceId = ""
    private var generation = 0L
    private var request = 0L

    @Synchronized
    fun activate(id: String): ResponseToken {
        deviceId = id
        generation += 1
        request += 1
        return ResponseToken(deviceId, generation, request)
    }

    @Synchronized
    fun nextRequest(): ResponseToken {
        request += 1
        return ResponseToken(deviceId, generation, request)
    }

    @Synchronized
    fun accepts(token: ResponseToken): Boolean =
        token.deviceId == deviceId && token.generation == generation && token.request == request
}
