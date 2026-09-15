"use client";

import { useEffect } from "react";

export default function OnlineHeartbeat() {
  useEffect(() => {
    const sendHeartbeat = () => {
      fetch("/api/me/heartbeat", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    };

    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, 15000);

    return () => clearInterval(interval);
  }, []);

  return null;
}