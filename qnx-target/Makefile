# QNX SDP 8.0 Cross-Compilation Makefile (aarch64le)
# Target: BlackBerry QNX Neutrino RTOS 8.0 / ARMv8.2 Cortex-A78AE

QCC      := qcc
VTARGET  := gcc_ntoaarch64le
CFLAGS   := -V$(VTARGET) -Wall -Wextra -O2 -D_QNX_SOURCE -fstack-protector-strong
LDFLAGS  := -V$(VTARGET) -lc

TARGET   := qnx_sentinel_daemon
SRCS     := qnx_pps_telemetry_daemon.cpp

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(SRCS) qnx_safety_watchdog.h
	$(QCC) $(CFLAGS) $(SRCS) -o $(TARGET) $(LDFLAGS)

clean:
	rm -f $(TARGET) *.o
