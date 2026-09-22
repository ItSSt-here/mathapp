Add-Type -AssemblyName System.Drawing

# Strips the pack's orange/yellow "energy leak" glow out of the severe-damage
# art (it reads as a blood drip, not fire, per user feedback) and replaces
# those pixels with the same near-black already used for the crack's void,
# so the crack stays but the ambiguous glow is gone. Smoke is added via CSS
# instead (see .dmg-severe .cg-smoke in style.css).
function Strip-Glow {
    param([string]$Path)

    $src = [System.Drawing.Bitmap]::FromFile($Path)
    $w = $src.Width; $h = $src.Height
    $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
    $data = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bytes = $data.Stride * $h
    $buf = New-Object byte[] $bytes
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $bytes)

    for ($y = 0; $y -lt $h; $y++) {
        $rowStart = $y * $data.Stride
        for ($x = 0; $x -lt $w; $x++) {
            $i = $rowStart + $x * 4
            $a = $buf[$i + 3]
            if ($a -eq 0) { continue }
            $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
            $c = [System.Drawing.Color]::FromArgb($r, $g, $b)
            $hue = $c.GetHue()
            $sat = $c.GetSaturation()
            if ($hue -ge 30 -and $hue -le 65 -and $sat -ge 0.5) {
                $buf[$i] = 13; $buf[$i+1] = 13; $buf[$i+2] = 13   # near-black void
            }
        }
    }

    [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $bytes)
    $src.UnlockBits($data)
    $src.Save("$Path.tmp.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $src.Dispose()
    Remove-Item $Path
    Rename-Item "$Path.tmp.png" $Path
}

Strip-Glow "C:\Itamar\claude-test\Mathapp\assets\castle\player\3-severe.png"
Strip-Glow "C:\Itamar\claude-test\Mathapp\assets\castle\enemy\3-severe.png"
Write-Output "done"
