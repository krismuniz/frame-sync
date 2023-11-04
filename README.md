# frame-sync

A minimal iframe synchronization library for React with runtime type checking via Zod.

> **NOTE**:
> I thought about this API for half a second, so it's probably not the best. I haven't even written tests for it yet. Use at your own risk.

## Installation

```bash
npm install --save frame-sync
```

## Usage

### Host

1. Create a Zod schema for the data you want to pass to the guest
2. Create a `GuestFrame` component with the schema and the URL of the guest
3. Pass the data to the `GuestFrame` component as props

```tsx
import { z } from 'zod';
import { getGuestFrame } from 'frame-sync';

const schema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().optional(),
});

const GuestFrame = getGuestFrame({
  schema,
  // the URL of the guest
  src: "http://guest-url.com/path/to/page",
  // the origin of the guest
  targetOrigin: "http://guest-url.com",
});

<GuestFrame name="Randall" age={50} email="randall@printloop.dev" />;
```

### Guest

1. Create a Zod schema for the data you want to receive from the host
2. Create a `Host` object with the schema, the origin of the host, and initial state to use before the host sends data
3. Provide the Host context to your app via `Host.Provider`
4. Consume the data from the Host object's React context via `useContext(Host.Context)`

```tsx
import { z } from 'zod';
import { getHost } from 'frame-sync';

const schema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().optional(),
});

const Host = getHost({
  schema,
  // the origin of the host
  origin: "http://host-url.com",
  // initial state to use before the host sends data
  initialState: {
    name: "Alex",
    age: 50,
    email: "alex@example.com"
  }
});

export function GuestApp () {
  return (
    <Host.Provider>
      <App />
    </Host.Provider>
  );
}
```

```tsx
// in a child component
export function SomeGuestComponent () {
  const { name, age, email } = useContext(Host.Context);

  return (
    <div>
      <p>Name: {name}</p>
      <p>Age: {age}</p>
      <p>Email: {email}</p>
    </div>
  );
}
```

If you want to stop listening to events from the host, you can call `Host.destroy()`.

## License

[MIT](LICENSE)

© 2023 [Kristian Muñiz](https://krismuniz.com)
