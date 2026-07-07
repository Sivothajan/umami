export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { POST } from '@/app/api/send/route';
import type { Pixel } from '@/generated/prisma/client';
import redis from '@/lib/redis';
import { findPixel } from '@/queries/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let pixel: Pixel;

  if (redis.enabled) {
    pixel = await redis.client.fetch(
      `pixel:${slug}`,
      async () => {
        return findPixel({
          where: {
            slug,
            deletedAt: null,
          },
        });
      },
      86400,
    );

    if (!pixel) {
      return NextResponse.json({ error: 'Pixel not found' }, { status: 404 });
    }
  } else {
    pixel = await findPixel({
      where: {
        slug,
        deletedAt: null,
      },
    });

    if (!pixel) {
      return NextResponse.json({ error: 'Pixel not found' }, { status: 404 });
    }
  }

  const payload = {
    type: 'event',
    payload: {
      pixel: pixel.id,
      url: request.url,
      referrer: request.headers.get('referer') || undefined,
    },
  };

  const req = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(payload),
  });

  await POST(req);

  return NextResponse.json({ pixel: true }, { status: 200 });
}
