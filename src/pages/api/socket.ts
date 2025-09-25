import type { NextApiRequest } from "next";
import type { NextApiResponse } from "next";
import type { Socket } from "net";
import type { Server as HTTPServer } from "http";
import { createSocketServer } from "@/server/realtime/socket-server";

export const config = {
  api: {
    bodyParser: false,
  },
};

type NextApiResponseWithSocket = NextApiResponse & {
  socket: Socket & {
    server: HTTPServer & {
      io?: ReturnType<typeof createSocketServer>;
    };
  };
};

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  const { socket } = res;

  if (!socket || !socket.server) {
    res.status(500).json({ error: "Serveur HTTP indisponible" });
    return;
  }

  if (!socket.server.io) {
    socket.server.io = createSocketServer(socket.server);
  }

  res.end();
}
