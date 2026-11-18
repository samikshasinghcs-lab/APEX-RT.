'use client';

import React, { useState } from 'react';
import { Terminal, FileCode2, Shield } from 'lucide-react';

const QNX_ARTIFACTS = [
  {
    filename: '/qnx-target/qnx_pps_telemetry_daemon.cpp',
    role: 'QNX Neutrino RTOS 8.0 PPS Telemetry Collector (SCHED_FIFO)',
    code: `/**
 * @file qnx_pps_telemetry_daemon.cpp
 * @brief QNX Neutrino RTOS PPS (Persistent Publish/Subscribe) Telemetry Collector
 * @note ASIL-D-inspired deterministic ring-buffer publisher for SiC Inverter & HV BMS frames.
 *       Designed for QNX SDP 8.0 (aarch64le) with POSIX real-time scheduling (SCHED_FIFO).
 */

#include <stdio.h>
#include <stdint.h>
#include <fcntl.h>
#include <unistd.h>
#include <sched.h>
#include <time.h>
#include <sys/neutrino.h>
#include "qnx_safety_watchdog.h"

#define PPS_TELEMETRY_PATH "/pps/qnx/sentinel/telemetry?wait,delta"
#define RING_BUFFER_SLOTS  256

typedef struct {
    uint64_t monotonic_ns;
    uint32_t can_id;
    float    junction_temp_c;
    float    dc_bus_voltage_v;
    uint16_t isolation_kohm;
    uint8_t  wcet_jitter_us;
    char     dtc_code[16];
    char     raw_log[256];
} sentinel_telemetry_frame_t;`,
  },
  {
    filename: '/qnx-target/qnx_safety_watchdog.h',
    role: 'ASIL-D-Inspired Deterministic Safety Pre-Filter Header (<50µs WCET)',
    code: `/**
 * @file qnx_safety_watchdog.h
 * @brief ASIL-D-Inspired Deterministic Safety Pre-Filter & Watchdog Header
 */

typedef enum {
    SAFETY_STATE_NOMINAL         = 0,
    SAFETY_STATE_THERMAL_WARN    = 1,
    SAFETY_STATE_ISOLATION_ERR   = 2,
    SAFETY_STATE_SAFE_TORQUE_OFF = 3
} qnx_safety_state_t;

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
}`,
  },
  {
    filename: '/qnx-target/Makefile',
    role: 'QNX SDP 8.0 Cross-Compilation Makefile (qcc -Vgcc_ntoaarch64le)',
    code: `# QNX SDP 8.0 Cross-Compilation Makefile (aarch64le)
QCC      := qcc
VTARGET  := gcc_ntoaarch64le
CFLAGS   := -V$(VTARGET) -Wall -Wextra -O2 -D_QNX_SOURCE -fstack-protector-strong
LDFLAGS  := -V$(VTARGET) -lc

TARGET   := qnx_sentinel_daemon
SRCS     := qnx_pps_telemetry_daemon.cpp

all: $(TARGET)
$(TARGET): $(SRCS) qnx_safety_watchdog.h
	$(QCC) $(CFLAGS) $(SRCS) -o $(TARGET) $(LDFLAGS)`,
  },
];

export default function QnxTargetViewer() {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const current = QNX_ARTIFACTS[activeFileIndex];

  return (
    <section
      aria-label="QNX C/C++ Target Artifacts"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Embedded QNX SDP 8.0 C/C++ Target Files (/qnx-target/)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ASIL-D-inspired POSIX real-time PPS telemetry collector &amp;
            deterministic safety pre-filter paired with the Web Hybrid AI bridge
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
          {QNX_ARTIFACTS.map((item, idx) => (
            <button
              key={item.filename}
              type="button"
              onClick={() => setActiveFileIndex(idx)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                activeFileIndex === idx
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>{item.filename.replace('/qnx-target/', '')}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <Terminal className="w-3.5 h-3.5" />
            {current.filename}
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Shield className="w-3.5 h-3.5" />
            {current.role}
          </span>
        </div>
        <pre className="text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
          <code>{current.code}</code>
        </pre>
      </div>
    </section>
  );
}
