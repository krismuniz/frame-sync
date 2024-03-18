# `@printloop/frame-sync`

A minimal iframe synchronization library for React with runtime type checking via Zod.

> **NOTE**
> I thought about this API for half a second, so it's probably not the best. I haven't even written tests for it yet. Use at your own risk.

## Installation

```bash
npm install --save @printloop/frame-sync
```

## Usage

### Host

1. Create a Zod schema for the data you want to pass to the guest
2. Create a `GuestFrame` component with the schema and the URL of the guest
3. Pass the data to the `GuestFrame` component as props

```tsx
import { z } from 'zod';
import { getGuestFrame } from '@printloop/frame-sync';

const schema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().optional(),
});

const GuestFrame = getGuestFrame({
  schema,
  // the URL of the guest
  src: "https://guest-url.com/path/to/page",
  // the origin of the guest
  targetOrigin: "https://guest-url.com",
});

<GuestFrame name="Randall" age={50} email="randall@printloop.dev" />;
```

### Guest

1. Create a Zod schema for the data you expect to receive from the host
2. Create a `Host` object with the schema, the origin of the host, and initial state to use before the host sends data
3. Consume the data from the `Host` through `useHostProps`

```tsx
import { z } from 'zod';
import { getHost } from '@printloop/frame-sync';

const schema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().optional(),
});

const { useHostProps } = getHost({
  schema,
  // the origin of the host
  targetOrigin: "http://host-url.com",
  // initial state to use before the host sends data
  initial: {
    name: "Alex",
    age: 50,
    email: "alex@example.com"
  }
});

export function SomeGuestComponent () {
  const { name, age, email } = useHostProps(Host.Context);

  return (
    <div>
      <p>Name: {name}</p>
      <p>Age: {age}</p>
      <p>Email: {email}</p>
    </div>
  );
}
```

## License

[MIT](LICENSE)

© 2023 [Kristian Muñiz](https://krismuniz.com)
