Add-Type -AssemblyName System.Drawing

function Recolor-Flag {
    param(
        [string]$SrcPath,
        [string]$DstPath,
        [double]$TargetHue  # 0-360
    )

    $src = [System.Drawing.Bitmap]::FromFile($SrcPath)
    $w = $src.Width
    $h = $src.Height
    $dst = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
    $srcData = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $dstData = $dst.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    $bytes = $srcData.Stride * $h
    $srcBuf = New-Object byte[] $bytes
    [System.Runtime.InteropServices.Marshal]::Copy($srcData.Scan0, $srcBuf, 0, $bytes)
    $dstBuf = New-Object byte[] $bytes

    for ($y = 0; $y -lt $h; $y++) {
        $rowStart = $y * $srcData.Stride
        for ($x = 0; $x -lt $w; $x++) {
            $i = $rowStart + $x * 4
            $b = $srcBuf[$i]
            $g = $srcBuf[$i + 1]
            $r = $srcBuf[$i + 2]
            $a = $srcBuf[$i + 3]

            if ($a -eq 0) {
                $dstBuf[$i] = 0; $dstBuf[$i+1] = 0; $dstBuf[$i+2] = 0; $dstBuf[$i+3] = 0
                continue
            }

            $c = [System.Drawing.Color]::FromArgb($r, $g, $b)
            $hue = $c.GetHue()
            $sat = $c.GetSaturation()
            $light = $c.GetBrightness()

            # Green flag hue band roughly 55-165 degrees; require some saturation
            # so near-gray stone pixels are left untouched.
            if ($hue -ge 55 -and $hue -le 165 -and $sat -ge 0.18) {
                $newColor = [Drawing.Color]::FromArgb(255, [Drawing.Color]::Black) # placeholder
                # Build from HSL manually since .NET has no HSL->RGB built-in on Color
                $newColor = $null
                $hh = $TargetHue / 60.0
                $cc = (1 - [Math]::Abs(2 * $light - 1)) * $sat
                $xx = $cc * (1 - [Math]::Abs(($hh % 2) - 1))
                $m = $light - $cc / 2
                if ($hh -lt 1) { $r1=$cc; $g1=$xx; $b1=0 }
                elseif ($hh -lt 2) { $r1=$xx; $g1=$cc; $b1=0 }
                elseif ($hh -lt 3) { $r1=0; $g1=$cc; $b1=$xx }
                elseif ($hh -lt 4) { $r1=0; $g1=$xx; $b1=$cc }
                elseif ($hh -lt 5) { $r1=$xx; $g1=0; $b1=$cc }
                else { $r1=$cc; $g1=0; $b1=$xx }
                $nr = [Math]::Round(($r1 + $m) * 255)
                $ng = [Math]::Round(($g1 + $m) * 255)
                $nb = [Math]::Round(($b1 + $m) * 255)
                $nr = [Math]::Max(0,[Math]::Min(255,$nr))
                $ng = [Math]::Max(0,[Math]::Min(255,$ng))
                $nb = [Math]::Max(0,[Math]::Min(255,$nb))
                $dstBuf[$i] = $nb
                $dstBuf[$i+1] = $ng
                $dstBuf[$i+2] = $nr
                $dstBuf[$i+3] = $a
            } else {
                $dstBuf[$i] = $b
                $dstBuf[$i+1] = $g
                $dstBuf[$i+2] = $r
                $dstBuf[$i+3] = $a
            }
        }
    }

    [System.Runtime.InteropServices.Marshal]::Copy($dstBuf, 0, $dstData.Scan0, $bytes)
    $src.UnlockBits($srcData)
    $dst.UnlockBits($dstData)
    $dst.Save($DstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $src.Dispose()
    $dst.Dispose()
}

$srcDir = "C:\Itamar\claude-test\assets\craftpix-234566-free-castle-2d-game-assets\png\1"
$stages = @{ "1-intact" = "Asset 21.png"; "2-damaged" = "Asset 22.png"; "3-severe" = "Asset 23.png" }

foreach ($stage in $stages.Keys) {
    $srcFile = Join-Path $srcDir $stages[$stage]
    Recolor-Flag -SrcPath $srcFile -DstPath "C:\Itamar\claude-test\Mathapp\assets\castle\player\$stage.png" -TargetHue 214   # blue
    Recolor-Flag -SrcPath $srcFile -DstPath "C:\Itamar\claude-test\Mathapp\assets\castle\enemy\$stage.png" -TargetHue 2     # red
}
Write-Output "done"
