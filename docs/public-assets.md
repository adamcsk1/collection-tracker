# Public Assets Library

Source: [`libs/public`](../libs/public)

`libs/public` contains the shared static assets copied into the Angular build outputs.

## Contents

- [`src/manifest.json`](../libs/public/src/manifest.json): shared web app manifest
- [`src/icons/`](../libs/public/src/icons): logos, favicons, Apple touch icon, and PWA icons
- [`src/images/`](../libs/public/src/images): shared image assets

## Usage

- `apps/client` copies `libs/public/src` into its build output.
- `apps/login` copies the same asset tree into its build output.
- `apps/health` copies the same asset tree into its build output.
- The shared assets provide consistent branding and PWA metadata across the Angular applications.

## Nx Targets

This library does not define standalone Nx targets.
