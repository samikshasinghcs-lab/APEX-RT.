/**
 * @file qnx_pps_telemetry_daemon.cpp
 * @brief QNX Neutrino RTOS PPS (Persistent Publish/Subscribe) Telemetry Collector
 * @note ASIL-D-inspired deterministic ring-buffer publisher for SiC Inverter & HV BMS frames.
 *       Designed for QNX SDP 8.0 (aarch64le) with POSIX real-time scheduling (SCHED_FIFO).
 */

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <sched.h>
#include <time.h>
#include <sys/neutrino.h>
#include "qnx_safety_watchdog.h"

#define PPS_TELEMETRY_PATH "/pps/qnx/sentinel/telemetry?wait,delta"
#define RING_BUFFER_SLOTS  256
#define MAX_PAYLOAD_BYTES  512

typedef struct {
    uint64_t monotonic_ns;
    uint32_t can_id;
    float    junction_temp_c;
    float    dc_bus_voltage_v;
    uint16_t isolation_kohm;
    uint8_t  wcet_jitter_us;
    char     dtc_code[16];
    char     raw_log[256];
} sentinel_telemetry_frame_t;

static sentinel_telemetry_frame_t g_ring_buffer[RING_BUFFER_SLOTS];
static volatile uint32_t g_write_idx = 0;

static uint64_t read_clock_monotonic_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ((uint64_t)ts.tv_sec * 1000000000ULL) + (uint64_t)ts.tv_nsec;
}

int publish_pps_frame(int pps_fd, const sentinel_telemetry_frame_t* frame) {
    if (pps_fd < 0 || frame == NULL) {
        return -1;
    }

    char pps_msg[MAX_PAYLOAD_BYTES];
    int len = snprintf(
        pps_msg,
        sizeof(pps_msg),
        "@telemetry\n"
        "monotonic_ns:n:%llu\n"
        "can_id:n:%u\n"
        "junction_temp_c:n:%.2f\n"
        "dc_bus_voltage_v:n:%.2f\n"
        "isolation_kohm:n:%u\n"
        "wcet_jitter_us:n:%u\n"
        "dtc_code::%s\n"
        "raw_log::%s\n",
        (unsigned long long)frame->monotonic_ns,
        frame->can_id,
        frame->junction_temp_c,
        frame->dc_bus_voltage_v,
        frame->isolation_kohm,
        frame->wcet_jitter_us,
        frame->dtc_code,
        frame->raw_log
    );

    if (len < 0 || (size_t)len >= sizeof(pps_msg)) {
        return -2;
    }

    ssize_t written = write(pps_fd, pps_msg, (size_t)len);
    return (written == len) ? 0 : -3;
}

void record_ring_buffer_frame(const sentinel_telemetry_frame_t* frame) {
    uint32_t slot = g_write_idx % RING_BUFFER_SLOTS;
    memcpy(&g_ring_buffer[slot], frame, sizeof(sentinel_telemetry_frame_t));
    __sync_synchronize();
    g_write_idx++;
}
