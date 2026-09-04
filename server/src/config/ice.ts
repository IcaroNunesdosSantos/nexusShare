import { env } from "./env.js";

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export function getIceServers(): IceServer[] {
  const servers: IceServer[] = [
    { urls: env.stunUrl },
    { urls: env.stunUrlSecondary },
  ];

  if (env.turnUrl && env.turnUsername && env.turnPassword) {
    servers.push({
      urls: env.turnUrl.split(",").map((u) => u.trim()).filter(Boolean),
      username: env.turnUsername,
      credential: env.turnPassword,
    });
  }

  return servers;
}
