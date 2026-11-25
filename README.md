# Rédaction

Appli Android personnelle pour écrire et organiser les articles du magazine. Tout reste sur le téléphone et fonctionne hors connexion.

## Installer l'appli

1. Sur le téléphone, ouvre ce lien et télécharge le fichier :
   **https://github.com/Pierro0871/Projets-annexes/raw/ccr-253f69ce-viz3fz/apk/Redaction.apk**
2. Ouvre le fichier téléchargé. Android demande d'autoriser l'installation d'applis de cette source (ton navigateur ou « Fichiers ») : accepte.
3. Appuie sur **Installer**.

Pour une mise à jour, refais la même chose : la nouvelle version s'installe par-dessus l'ancienne et garde tes articles.

## Ce que fait l'appli

- **Articles** : éditeur avec titre, chapô, intertitres, gras/italique, citations, listes, images. Compteur de mots et de signes, objectif de longueur, mode concentration. Enregistrement automatique.
- **Statuts** : Idée → Brouillon → Relecture → Prêt → Publié.
- **Sources** : liens, citations, contacts, interviews et notes, rattachés à un article ou rangés librement dans « Recherches ».
- **Médias** : photos avec légende et crédit, à insérer dans le texte.
- **Versions** : historique automatique (en quittant l'article et toutes les 10 min), restauration en un geste.
- **Idées** : banque d'idées, transformables en article.
- **Numéros** : sommaire par rubrique ou par statut, dates de bouclage et de parution, avancement.
- **Agenda** : calendrier des échéances, bouclages et parutions.
- **Rappels** : notifications avant les échéances (réglables).
- **Exports** : PDF manuscrit, PDF mis en page façon magazine (deux colonnes, lettrine), Word (.docx).
- **Sauvegarde** : un fichier unique à ranger sur Drive ou à envoyer par mail, et restauration.
- Thème clair / sombre, rubriques personnalisables.

Dictée vocale et correcteur orthographique : ceux du clavier Android (Gboard), directement dans l'éditeur.

## Pour les développeurs

Code dans `redaction/` (React + TypeScript + Vite, empaqueté avec Capacitor).

```bash
cd redaction
npm install
npm run dev                # version navigateur
./scripts/build-apk.sh     # APK signée → apk/Redaction.apk (nécessite le SDK Android)
```
