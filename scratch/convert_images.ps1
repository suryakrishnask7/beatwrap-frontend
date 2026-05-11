Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile("C:\Users\surya\.gemini\antigravity\brain\3e7f6992-8eeb-4a43-a626-76b31ef3ca59\media__1778470818600.jpg")
$image.Save("C:\Users\surya\OneDrive\Desktop\BeatWrap\beatwrap-frontend\assets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$image.Save("C:\Users\surya\OneDrive\Desktop\BeatWrap\beatwrap-frontend\assets\adaptive-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$image.Save("C:\Users\surya\OneDrive\Desktop\BeatWrap\beatwrap-frontend\assets\splash.png", [System.Drawing.Imaging.ImageFormat]::Png)
$image.Dispose()
