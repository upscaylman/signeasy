@echo off
echo ========================================
echo  ENVOI DU CODE SUR GITHUB
echo ========================================
echo.

REM Initialiser Git (si ce n'est pas deja fait)
echo [1/6] Initialisation de Git...
git init
echo.

REM Ajouter le remote GitHub
echo [2/6] Configuration du repository distant...
git remote remove origin 2>nul
git remote add origin https://github.com/upscaylman/signeasy.git
echo.

REM Creer un fichier .gitignore si inexistant
echo [3/6] Configuration de .gitignore...
if not exist .gitignore (
    echo node_modules/ > .gitignore
    echo dist/ >> .gitignore
    echo .env.local >> .gitignore
    echo .DS_Store >> .gitignore
    echo *.log >> .gitignore
    echo .vscode/ >> .gitignore
)
echo.

REM Ajouter tous les fichiers
echo [4/6] Ajout de tous les fichiers...
git add .
echo.

REM Commit
echo [5/6] Creation du commit...
git commit -m "Initial commit: SignEase - Plateforme de signature electronique"
echo.

REM Push vers GitHub
echo [6/6] Envoi vers GitHub...
echo.
echo ATTENTION: Vous allez etre redirige vers GitHub pour vous connecter.
echo.
pause

git branch -M main
git push -u origin main

echo.
echo ========================================
echo  TERMINE !
echo ========================================
echo.
echo Votre code est maintenant sur: https://github.com/upscaylman/signeasy
echo.
pause


