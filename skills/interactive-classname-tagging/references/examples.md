# Examples

Use these examples when deciding where to place `minium-anchor-<4hex>` and how it should coexist with existing classes.

The button and input examples below are adapted from the real demo pages under:

- `examples/demo-miniapp/src/pages/login/index.tsx`
- `examples/demo-miniapp/src/pages/home/index.tsx`

## Example: clickable button with an existing business class

Before:

```xml
<button class="login-submit primary" bindtap="handleSubmit">
  Submit
</button>
```

After:

```xml
<button
  class="login-submit primary minium-anchor-a1b2"
  bindtap="handleSubmit"
>
  Submit
</button>
```

Why:

- the existing `login-submit primary` classes stay intact
- the dedicated marker is added on the actual event-bound node

## Example: input field inside a styled wrapper

Before:

```xml
<view class="search-box">
  <input class="search-input" bindinput="handleInput" />
</view>
```

After:

```xml
<view class="search-box">
  <input
    class="search-input minium-anchor-0f3c"
    bindinput="handleInput"
  />
</view>
```

Why:

- the wrapper is only a layout shell
- the input is the real interaction node and gets the dedicated marker

## Example: decorative node should remain untagged

Before:

```xml
<view class="hero">
  <image class="hero-bg" src="/assets/hero.png" />
  <text class="hero-title">Welcome</text>
</view>
```

After:

```xml
<view class="hero">
  <image class="hero-bg" src="/assets/hero.png" />
  <text class="hero-title">Welcome</text>
</view>
```

Why:

- there is no interaction target
- no dedicated automation anchor is needed

## Example: existing business class does not waive dedicated tagging

Before:

```xml
<view class="profile-avatar-upload" bindtap="chooseAvatar">
  Change avatar
</view>
```

After:

```xml
<view
  class="profile-avatar-upload minium-anchor-9d7e"
  bindtap="chooseAvatar"
>
  Change avatar
</view>
```

Why:

- `profile-avatar-upload` is still a business class
- the dedicated marker is explicit and machine-targetable
