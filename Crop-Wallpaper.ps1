<#
.SYNOPSIS
为一张壁纸生成电脑端和手机端壁纸。支持 Windows PowerShell 5.1 和 PowerShell 7。
.DESCRIPTION
按小图的轮廓和暖色区域估算视觉重点，在不拉伸的前提下为每个长宽比单独取景。
横屏图写入源图所在主题目录的 desktop 子文件夹，竖屏图写入 mobile 子文件夹，文件名沿用源图名。
群像、逆光或复杂背景可用 KeepRegion 指定要保留的区域。
四个数字分别为左、上、右、下边界占整张图的比例，取值为 0 到 1。
区域太宽时优先保留较多的指定区域，再比较图像细节。
.EXAMPLE
.\Crop-Wallpaper.ps1 .\wallpaper_day\KOn_day.jpg -KeepRegion 0.15,0.09,0.402,0.60
.EXAMPLE
.\Crop-Wallpaper.ps1 .\wallpaper_night\sola_night.jpg
.PARAMETER OutputDirectory
接收 desktop 和 mobile 两个子文件夹的主题目录，默认使用源图所在目录。
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)][string]$InputImage,
    [string]$OutputDirectory,
    [ValidateCount(4,4)][ValidateRange(0,1)][double[]]$KeepRegion
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$source = Get-Item -LiteralPath $InputImage
if (!$OutputDirectory) { $OutputDirectory = $source.DirectoryName }
if ($KeepRegion -and ($KeepRegion[2] -le $KeepRegion[0] -or $KeepRegion[3] -le $KeepRegion[1])) {
    throw 'KeepRegion requires left < right and top < bottom.'
}

function Get-DetailProfile([Drawing.Bitmap]$thumbnail, [bool]$horizontal) {
    $length = if ($horizontal) { $thumbnail.Width } else { $thumbnail.Height }
    $profile = [double[]]::new($length)
    for ($y = 1; $y -lt $thumbnail.Height; $y++) {
        for ($x = 1; $x -lt $thumbnail.Width; $x++) {
            $p = $thumbnail.GetPixel($x, $y)
            $left = $thumbnail.GetPixel($x - 1, $y)
            $above = $thumbnail.GetPixel($x, $y - 1)
            $edge = [Math]::Abs($p.GetBrightness() - $left.GetBrightness()) +
                    [Math]::Abs($p.GetBrightness() - $above.GetBrightness())
            $warm = $p.R -gt 90 -and $p.R -gt $p.G * 1.04 -and
                    $p.G -ge $p.B -and ($p.R - $p.B) -lt 115
            $axis = if ($horizontal) { $x } else { $y }
            $profile[$axis] += [Math]::Min(1, $edge * 3) + 0.35 * [int]$warm
        }
    }
    return ,$profile
}

function Find-CropStart([double[]]$profile, [double]$fraction, [double[]]$region) {
    $margin = 1 - $fraction
    if ($margin -lt 0.000001) { return 0 }
    $best = [double]::NegativeInfinity
    $steps = [Math]::Max(1, [Math]::Ceiling($margin * $profile.Length * 2))
    $total = [Math]::Max(1, ($profile | Measure-Object -Sum).Sum)
    $bestStart = 0
    for ($i = 0; $i -le $steps; $i++) {
        $start = $margin * $i / $steps
        $energy = 0
        for ($j = 0; $j -lt $profile.Length; $j++) {
            $position = (($j + 0.5) / $profile.Length - $start) / $fraction
            if ($position -le 0 -or $position -ge 1) { continue }
            # Favor subjects inside the frame, with breathing room at both edges.
            $weight = [Math]::Min(1, 8 * [Math]::Min($position, 1 - $position))
            $energy += $profile[$j] * $weight
        }
        $score = $energy / $total - 0.025 * [Math]::Abs($start + $fraction / 2 - 0.5)
        if ($region) {
            $overlap = [Math]::Max(0, [Math]::Min($start + $fraction, $region[1]) - [Math]::Max($start, $region[0]))
            $score += 8 * $overlap / ($region[1] - $region[0])
        }
        if ($score -gt $best) { $best = $score; $bestStart = $start }
    }
    return $bestStart
}

$img = [Drawing.Image]::FromFile($source.FullName)
try {
    if ($img.PropertyIdList -contains 274) {
        $rotation = @(0,0,4,2,6,5,1,7,3)[[BitConverter]::ToUInt16($img.GetPropertyItem(274).Value, 0)]
        if ($rotation) { $img.RotateFlip([Drawing.RotateFlipType]$rotation) }
    }
    $scale = 128 / [double][Math]::Max($img.Width, $img.Height)
    $thumb = [Drawing.Bitmap]::new($img, [Math]::Max(2,[int]($img.Width*$scale)), [Math]::Max(2,[int]($img.Height*$scale)))
    try {
        $across = Get-DetailProfile $thumb $true
        $down = Get-DetailProfile $thumb $false
    } finally { $thumb.Dispose() }
    $regionX = $regionY = $null
    if ($KeepRegion) { $regionX = $KeepRegion[0,2]; $regionY = $KeepRegion[1,3] }
    $directory = [IO.Directory]::CreateDirectory($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory))
    $jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
    $quality = [Drawing.Imaging.EncoderParameters]::new(1)
    $quality.Param[0] = [Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality, [long]94)
    $wrap = [Drawing.Imaging.ImageAttributes]::new()
    $wrap.SetWrapMode([Drawing.Drawing2D.WrapMode]::TileFlipXY)
    try {
        foreach ($target in @(@('desktop',3840,2160), @('mobile',1440,2880))) {
            $name, $w, $h = $target
            $cw = [Math]::Min([double]$img.Width, $img.Height * $w / [double]$h)
            $ch = [Math]::Min([double]$img.Height, $img.Width * $h / [double]$w)
            $x = $img.Width * (Find-CropStart $across ($cw/$img.Width) $regionX)
            $y = $img.Height * (Find-CropStart $down ($ch/$img.Height) $regionY)
            $folder = [IO.Directory]::CreateDirectory((Join-Path $directory.FullName $name))
            $path = Join-Path $folder.FullName ($source.BaseName + '.jpg')
            $tmp = $path + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
            $bitmap = [Drawing.Bitmap]::new($w,$h,[Drawing.Imaging.PixelFormat]::Format24bppRgb)
            try {
                $g = [Drawing.Graphics]::FromImage($bitmap)
                try {
                    $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                    $g.DrawImage($img,[Drawing.Rectangle]::new(0,0,$w,$h),[single]$x,[single]$y,[single]$cw,[single]$ch,[Drawing.GraphicsUnit]::Pixel,$wrap)
                } finally { $g.Dispose() }
                $bitmap.Save($tmp,$jpeg,$quality)
                if ([IO.File]::Exists($path)) { [IO.File]::Replace($tmp,$path,[NullString]::Value) }
                else { [IO.File]::Move($tmp,$path) }
                Write-Output ("{0}  crop={1},{2},{3},{4}  output={5}x{6}" -f $path,[int]$x,[int]$y,[int]$cw,[int]$ch,$w,$h)
            } finally {
                $bitmap.Dispose()
                if ([IO.File]::Exists($tmp)) { [IO.File]::Delete($tmp) }
            }
        }
    } finally { $wrap.Dispose(); $quality.Dispose() }
} finally { $img.Dispose() }
