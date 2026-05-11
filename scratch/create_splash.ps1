Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Image]::FromFile("C:\Users\surya\OneDrive\Desktop\BeatWrap\beatwrap-frontend\assets\icon.png")
$width = 1242
$height = 2436
$splash = new-object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($splash)
$g.Clear([System.Drawing.Color]::Black)
$iconWidth = 400
$iconHeight = 400
$x = ($width - $iconWidth) / 2
$y = ($height - $iconHeight) / 2
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($icon, $x, $y, $iconWidth, $iconHeight)
$splash.Save("C:\Users\surya\OneDrive\Desktop\BeatWrap\beatwrap-frontend\assets\splash.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$splash.Dispose()
$icon.Dispose()
