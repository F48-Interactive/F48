import { z } from 'zod';
import { ZodValidationPipe } from '../../../src/common/pipes/zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(
    z.object({
      channelUrl: z.string().url(),
    }),
  );

  it('validates body payloads', () => {
    expect(
      pipe.transform(
        { channelUrl: 'https://youtube.com/@f48' },
        { type: 'body', metatype: Object },
      ),
    ).toEqual({ channelUrl: 'https://youtube.com/@f48' });
  });

  it('does not transform authenticated users or other non-body params', () => {
    const user = {
      id: 'user-1',
      firebaseUid: 'firebase-1',
      email: 'user@example.com',
      role: 'organizer',
      status: 'active',
    };

    expect(
      pipe.transform(user, { type: 'custom', metatype: Object }),
    ).toBe(user);
  });
});
