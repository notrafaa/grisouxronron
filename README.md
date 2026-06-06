# Squeechie Cats

Jeu Next.js/Vercel avec deux modes:

- `/clicker`: farm clicker avec compte pseudo + mot de passe, choix de chat, sauvegarde Supabase, upgrades, sons WebAudio, classement et curseurs des autres joueurs en realtime.
- `/duel`: lobby 1v1, owner qui lance le match, PV style combat, scores realtime, events aleatoires et musique MP3 en boucle.

## Lancer en local

```bash
npm install
npm run dev
```

Ouvre `http://localhost:3000`.

Sans variables Supabase, le site passe en mode demo avec `localStorage`. C'est pratique pour tester l'interface.

## Brancher Supabase

1. Cree un projet Supabase.
2. Dans Supabase, active `Authentication > Sign In / Providers > Email`.
3. Dans `Authentication > Sign In / Providers > Email`, desactive la confirmation email. Le jeu utilise des pseudos, pas de vraies adresses email.
4. Ouvre `SQL Editor` et execute le contenu de `supabase/schema.sql`.
5. Copie `.env.example` vers `.env.local`.
6. Renseigne:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ton-anon-key
```

Attention: `NEXT_PUBLIC_SUPABASE_URL` ne doit jamais etre l'URL Vercel. Si tu vois une requete vers `/auth/v1/signup` sur `grisouxronron.vercel.app`, la variable est mauvaise. Elle doit pointer vers Supabase, par exemple `https://abcxyz.supabase.co`.

Le joueur cree un compte avec pseudo + mot de passe, puis peut se reconnecter avec les memes infos pour retrouver sa sauvegarde. Le pseudo est unique grace a un index SQL sur `lower(username)`, donc `Milo` et `milo` ne peuvent pas exister en double.

Le clicker sauvegarde aussi:

- les rebirths
- les croquettes de vie entiere
- les niveaux de Grisou et Ronron
- toutes les upgrades de boutique

Si tu ajoutes cette version sur une base deja existante, reexecute `supabase/schema.sql` pour ajouter les nouvelles colonnes.

Pour le realtime:

- Dans Supabase, verifie que Realtime est active pour `duel_lobbies`, `duel_players` et `duel_events`.
- Le schema essaie de les ajouter automatiquement a la publication `supabase_realtime`.
- Les curseurs du clicker utilisent Supabase Realtime Broadcast.

## Deployer sur Vercel

Ajoute les memes variables dans `Project Settings > Environment Variables`, puis deploie normalement le repo Next.js.

## Remplacer les chats

Les images temporaires sont ici:

```txt
public/cats/grisou.png
public/cats/ronron.png
```

Tu peux les remplacer par tes fichiers IA en gardant les memes noms, ou modifier les chemins dans `src/components/ClickerGame.tsx`.

## Musiques duel

Place tes MP3 dans:

```txt
public/music/
```

Par defaut le duel cherche:

```txt
public/music/track-1.mp3
public/music/track-2.mp3
...
public/music/track-11.mp3
```

Le volume commence a `0.40` et chaque joueur peut l'ajuster dans l'interface.
