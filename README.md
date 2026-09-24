# Content Weaver

Rules (strict):
1. Design / structure / text / image — kichu change kora jabe na. Pixel-perfect same thakte hobe.
2. Kono redesign, notun section, notun color ba layout change no — sudhu "dynamic" korte hobe.
3. Sob text ar image database (Lovable Cloud) theke asbe — page e kono hardcoded
   text/image thakbe na. Prottek ta text er jonno ekta unique key thakbe, prottek ta
   image er jonno ekta slot thakbe.
4. Ekta admin/editor mode banaw jekhane theke ami:
   - je kono text click kore edit korte parbo
   - je kono image replace korte parbo
   - change save korlei public site e sathe sathe show korbe
5. Admin access login diye secure hobe (username/password), server-side validation thakbe.
6. Database tables: text content er jonno ekta table (key + value + language),
   images er jonno storage bucket + mapping table. RLS: public read-only,
   write sudhu logged-in admin.
7. Page speed kom hobe na — content cache hobe, images lazy-load hobe.
8. Website e jodi onek gulo page thake, sob page ei vabe dynamic hobe.
9. SEO (title, description, meta tags) jeno same thake ba aro valo hoy.

Age static site ta puro scan kore ekta list dao: koto gulo editable text ar image ase,
tarpor database schema banaw, tarpor step by step convert koro.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/790795fb-8f86-4af8-945d-b0e101c07e28).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
