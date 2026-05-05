# Run from C:\TopicIS\backend\
# Creates an isolated venv, installs dependencies, and starts the server.

Write-Host "== Step 1: Create isolated virtual environment ==" -ForegroundColor Cyan
python -m venv venv

Write-Host "== Step 2: Activate venv ==" -ForegroundColor Cyan
.\venv\Scripts\Activate.ps1

Write-Host "== Step 3: Upgrade pip ==" -ForegroundColor Cyan
python -m pip install --upgrade pip

Write-Host "== Step 4: Install dependencies (fresh, no Anaconda conflicts) ==" -ForegroundColor Cyan
pip install -r requirements.txt

Write-Host "== Step 5: Copy env file ==" -ForegroundColor Cyan
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  -> Created .env  — add your OPENAI_API_KEY now!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "All done. Start the server with:" -ForegroundColor Green
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  uvicorn app.main:app --reload" -ForegroundColor White
