@echo off
echo Configuration CORS pour Firebase Storage...
echo.
echo 1. Connectez-vous à Google Cloud :
echo    gcloud auth login
echo.
echo 2. Définissez votre projet :
echo    gcloud config set project signeasyfo
echo.
echo 3. Appliquez la configuration CORS :
echo    gsutil cors set cors.json gs://signeasyfo.firebasestorage.app
echo.
echo Appuyez sur une touche pour continuer...
pause > nul

gcloud auth login
gcloud config set project signeasyfo
gsutil cors set cors.json gs://signeasyfo.firebasestorage.app

echo.
echo Configuration CORS terminée !
pause

