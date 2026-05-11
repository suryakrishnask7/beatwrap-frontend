Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile("C:\Users\surya\.gemini\antigravity\brain\3e7f6992-8eeb-4a43-a626-76b31ef3ca59\media__1778470818600.jpg")
$favicon = new-object System.Drawing.Bitmap(48, 48)
$g = [System.Drawing.Graphics]::FromImage($favicon)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($image, 0, 0, 48, 48)
$favicon.Save("C:\Users\surya\OneDrive\Desktop\BeatWrap\beatwrap-frontend\assets\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$favicon.Dispose()
$image.Dispose()
