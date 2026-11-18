/**
 * @file qnx_safety_watchdog.h
 * @brief ASIL-D-Inspired Deterministic Safety Pre-Filter & Watchdog Header
 * @note Enforces deterministic local threshold checks (<50us WCET) on QNX RTOS prior to
 *       dispatching non-critical diagnostic frames to the Hybrid AI Edge/Cloud bridge.
 */

#ifndef QNX_SAFETY_WATCHDOG_H
#define QNX_SAFETY_WATCHDOG_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    SAFETY_STATE_NOMINAL       = 0,
    SAFETY_STATE_THERMAL_WARN  = 1,
    SAFETY_STATE_ISOLATION_ERR = 2,
    SAFETY_STATE_SAFE_TORQUE_OFF = 3
} qnx_safety_state_t;

typedef struct {
    float    max_sic_junction_temp_c;   /* Default: 175.0 C */
    uint16_t min_hv_isolation_kohm;     /* Default: 100 kOhm ( ~125 Ohms/V @ 800V ) */
    uint8_t  max_sched_fifo_jitter_us;  /* Default: 150 us */
} qnx_safety_thresholds_t;

static inline qnx_safety_state_t evaluate_deterministic_guard(
    float junction_temp_c,
    uint16_t isolation_kohm,
    uint8_t wcet_jitter_us,
    const qnx_safety_thresholds_t* bounds
) {
    if (isolation_kohm < bounds->min_hv_isolation_kohm) {
        return SAFETY_STATE_SAFE_TORQUE_OFF;
    }
    if (junction_temp_c >= bounds->max_sic_junction_temp_c) {
        return SAFETY_STATE_THERMAL_WARN;
    }
    if (wcet_jitter_us > bounds->max_sched_fifo_jitter_us) {
        return SAFETY_STATE_ISOLATION_ERR;
    }
    return SAFETY_STATE_NOMINAL;
}

#ifdef __cplusplus
}
#endif

#endif /* QNX_SAFETY_WATCHDOG_H */
