# Client Integration

The same REST API works for browsers, React Native, and Flutter. All clients send the access token as:

```http
Authorization: Bearer <access-token>
```

Access tokens are intentionally short-lived. Refresh handling differs by client because browsers can protect a refresh token with an HttpOnly cookie, while mobile applications must use OS-backed secure storage.

## Web application

Login with `clientType: "WEB"` and enable credentials. The API sets the refresh token in an HttpOnly cookie and does not expose it to JavaScript.

```ts
const loginResponse = await fetch(`${API_URL}/api/v1/auth/login`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier, password, clientType: "WEB" })
});

const { data } = await loginResponse.json();
let accessToken = data.accessToken; // Keep in memory, not localStorage.

async function refreshAccessToken() {
  const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  const payload = await response.json();
  accessToken = payload.data.accessToken;
}
```

## React Native

Login with `clientType: "MOBILE"`. Store only the refresh token in Expo SecureStore or the platform Keychain/Keystore. Keep the access token in memory.

```ts
import * as SecureStore from "expo-secure-store";

const response = await fetch(`${API_URL}/api/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier, password, clientType: "MOBILE" })
});
const payload = await response.json();
await SecureStore.setItemAsync("refresh_token", payload.data.refreshToken);
let accessToken = payload.data.accessToken;

async function refreshMobileToken() {
  const refreshToken = await SecureStore.getItemAsync("refresh_token");
  const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  const payload = await response.json();
  await SecureStore.setItemAsync("refresh_token", payload.data.refreshToken);
  accessToken = payload.data.accessToken;
}
```

## Flutter

Use `flutter_secure_storage` for the refresh token and keep the access token in application memory.

```dart
final storage = FlutterSecureStorage();
final response = await dio.post('/api/v1/auth/login', data: {
  'identifier': identifier,
  'password': password,
  'clientType': 'MOBILE',
});
await storage.write(key: 'refresh_token', value: response.data['data']['refreshToken']);
accessToken = response.data['data']['accessToken'];

Future<void> refreshToken() async {
  final refresh = await storage.read(key: 'refresh_token');
  final response = await dio.post('/api/v1/auth/refresh', data: {'refreshToken': refresh});
  await storage.write(key: 'refresh_token', value: response.data['data']['refreshToken']);
  accessToken = response.data['data']['accessToken'];
}
```

## Idempotent writes

For purchases, payments, reversals, and delivery writes, generate one unique key per user action and reuse it only when retrying the same request.

```http
Idempotency-Key: 9be6c11d-980d-4936-a7b1-bcaa84fefc80
```

## Decimal values

Send money and quantities as strings to avoid JavaScript and Dart floating-point errors:

```json
{
  "amount": "1250.50",
  "quantity": "12.750"
}
```
