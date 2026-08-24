@echo off
echo Iniciando o Sistema de Gestao Escolar (Disciplina + Notas)...

start "SGD - Backend (API)" cmd /k "cd /d C:\sistemas\SGD && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

start "SGD - Frontend (Site)" cmd /k "cd /d C:\sistemas\SGD\frontend && npm run dev"

echo.
echo Duas janelas foram abertas: uma do Backend e uma do Frontend.
echo Aguarde alguns segundos e depois acesse: http://localhost:3000
echo NAO feche essas janelas enquanto estiver usando o sistema.
pause
