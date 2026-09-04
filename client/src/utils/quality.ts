import type { FpsPreset, QualityPreset } from "../types";

export function constraintsFor(quality: QualityPreset, fps: FpsPreset, includeAudio: boolean): MediaStreamConstraints {
  const video: MediaTrackConstraints = {
    frameRate: { ideal: fps, max: fps },
    cursor: "always",
  } as MediaTrackConstraints;

  if (quality === "720p") {
    video.width = { ideal: 1280, max: 1280 };
    video.height = { ideal: 720, max: 720 };
  } else if (quality === "1080p") {
    video.width = { ideal: 1920, max: 1920 };
    video.height = { ideal: 1080, max: 1080 };
  }

  return {
    video,
    audio: includeAudio
      ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      : false,
  };
}

export async function adaptBitrate(pc: RTCPeerConnection, quality: QualityPreset): Promise<void> {
  const senders = pc.getSenders().filter((s) => s.track?.kind === "video");
  const maxBitrate = quality === "720p" ? 1_500_000 : quality === "1080p" ? 3_000_000 : 2_500_000;
  for (const sender of senders) {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = maxBitrate;
    try {
      await sender.setParameters(params);
    } catch {
      /* ignore unsupported */
    }
  }
}

export async function degradeIfSlow(pc: RTCPeerConnection): Promise<boolean> {
  try {
    const stats = await pc.getStats();
    let rtt = 0;
    let packetsLost = 0;
    let packetsSent = 0;
    stats.forEach((report) => {
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        rtt = Number(report.currentRoundTripTime ?? 0);
      }
      if (report.type === "outbound-rtp" && report.kind === "video") {
        packetsLost = Number(report.packetsLost ?? 0);
        packetsSent = Number(report.packetsSent ?? 0);
      }
    });
    const loss = packetsSent > 0 ? packetsLost / packetsSent : 0;
    if (rtt > 0.35 || loss > 0.08) {
      const senders = pc.getSenders().filter((s) => s.track?.kind === "video");
      for (const sender of senders) {
        const params = sender.getParameters();
        if (!params.encodings?.length) continue;
        params.encodings[0].maxBitrate = 800_000;
        params.encodings[0].maxFramerate = 15;
        await sender.setParameters(params);
      }
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
