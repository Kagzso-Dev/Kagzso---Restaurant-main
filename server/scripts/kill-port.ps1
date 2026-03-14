# 1. Finds the exact port you want to free up
$port = 5005

# 2. Runs the Windows netstat command to find processes LISTENING on port 5005
$connections = netstat -ano | Select-String ":$port\s+.*LISTENING"

# 3. Loops through any matches found
foreach ($line in $connections) {
    # 4. Cleans up the invisible spacing Windows adds to netstat output
    $parts = $line -split '\s+' | Where-Object { $_ -ne '' }
    
    # 5. Grabs the last column, which is always the Process ID
    $targetPid = $parts[-1]
    
    # 6. Safety check: makes sure the ID is a real number and not 0 (System)
    if ($targetPid -match '^\d+$' -and $targetPid -ne '0') {
        Write-Host "Releasing port $port (PID $targetPid)..."
        try {
            # 7. Force-kills the exact node.exe process holding the port open
            Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
            Write-Host "Done."
        }
        catch {
            # Safe catch in case the process died automatically mid-execution
        }
    }
}
# 8. Exits with success code 0 so `npm start` can continue
exit 0
