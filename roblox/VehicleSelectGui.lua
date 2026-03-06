-- VehicleSelectGui.lua
-- LocalScript: StarterGui に配置
-- ゲーム開始時に車種を選択するUI。選択後 DeathmatchManager に通知。

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService      = game:GetService("TweenService")

local Settings = require(ReplicatedStorage:WaitForChild("CarSettings"))
local player   = Players.LocalPlayer
local gui      = player:WaitForChild("PlayerGui")

local remotes         = ReplicatedStorage:WaitForChild("DeathmatchRemotes", 30)
local evSelectVehicle = remotes:WaitForChild("SelectVehicle", 10)

-- ============================================================
-- UI 構築
-- ============================================================
local screenGui              = Instance.new("ScreenGui")
screenGui.Name               = "VehicleSelectGui"
screenGui.ResetOnSpawn       = false
screenGui.IgnoreGuiInset     = true
screenGui.Parent             = gui

-- 半透明背景
local overlay                    = Instance.new("Frame")
overlay.Size                     = UDim2.fromScale(1, 1)
overlay.BackgroundColor3         = Color3.fromRGB(0, 0, 0)
overlay.BackgroundTransparency   = 0.4
overlay.BorderSizePixel          = 0
overlay.Parent                   = screenGui

-- パネル
local panel                  = Instance.new("Frame")
panel.Size                   = UDim2.fromOffset(660, 420)
panel.Position               = UDim2.fromScale(0.5, 0.5)
panel.AnchorPoint            = Vector2.new(0.5, 0.5)
panel.BackgroundColor3       = Color3.fromRGB(20, 20, 20)
panel.BorderSizePixel        = 0
panel.Parent                 = overlay

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 12)
corner.Parent       = panel

-- タイトル
local title              = Instance.new("TextLabel")
title.Size               = UDim2.new(1, 0, 0, 52)
title.BackgroundTransparency = 1
title.Text               = "車種を選んでください"
title.TextColor3         = Color3.fromRGB(255, 255, 255)
title.TextScaled         = true
title.Font               = Enum.Font.GothamBold
title.Parent             = panel

-- ボタン配置コンテナ
local container              = Instance.new("Frame")
container.Size               = UDim2.new(1, -40, 1, -72)
container.Position           = UDim2.fromOffset(20, 60)
container.BackgroundTransparency = 1
container.Parent             = panel

local grid                   = Instance.new("UIGridLayout")
grid.CellSize                = UDim2.fromOffset(120, 140)
grid.CellPadding             = UDim2.fromOffset(12, 12)
grid.HorizontalAlignment     = Enum.HorizontalAlignment.Center
grid.VerticalAlignment       = Enum.VerticalAlignment.Center
grid.Parent                  = container

-- ============================================================
-- 車種ごとのボタン色
-- ============================================================
local vehicleOrder = { "Normal", "Police", "Ambulance", "Fire", "VIP" }

local buttonColors = {
    Normal    = Color3.fromRGB(200, 50,  50 ),
    Police    = Color3.fromRGB(40,  80,  200),
    Ambulance = Color3.fromRGB(200, 200, 200),
    Fire      = Color3.fromRGB(210, 80,  20 ),
    VIP       = Color3.fromRGB(190, 150, 0  ),
}

-- ============================================================
-- ボタン生成
-- ============================================================
for _, vType in ipairs(vehicleOrder) do
    local vConfig = Settings.Vehicles[vType]
    if not vConfig then continue end

    local btn                    = Instance.new("TextButton")
    btn.Size                     = UDim2.fromScale(1, 1)
    btn.BackgroundColor3         = buttonColors[vType] or Color3.fromRGB(80, 80, 80)
    btn.BorderSizePixel          = 0
    btn.AutoButtonColor          = true
    btn.Text                     = ""
    btn.Parent                   = container

    local btnCorner              = Instance.new("UICorner")
    btnCorner.CornerRadius       = UDim.new(0, 8)
    btnCorner.Parent             = btn

    -- 車種名ラベル
    local nameLabel              = Instance.new("TextLabel")
    nameLabel.Size               = UDim2.new(1, 0, 0, 28)
    nameLabel.Position           = UDim2.fromOffset(0, 6)
    nameLabel.BackgroundTransparency = 1
    nameLabel.Text               = vConfig.DisplayName
    nameLabel.TextColor3         = Color3.fromRGB(255, 255, 255)
    nameLabel.TextScaled         = true
    nameLabel.Font               = Enum.Font.GothamBold
    nameLabel.Parent             = btn

    -- ステータスラベル（HP・速度・アビリティ）
    local statsLabel             = Instance.new("TextLabel")
    statsLabel.Size              = UDim2.new(1, -8, 0, 60)
    statsLabel.Position          = UDim2.new(0, 4, 0, 40)
    statsLabel.BackgroundTransparency = 1
    statsLabel.Text              = string.format("HP: %d\n速度: %d\n[E] %s",
        vConfig.HP, vConfig.MaxSpeed, vConfig.Ability)
    statsLabel.TextColor3        = Color3.fromRGB(240, 240, 240)
    statsLabel.TextScaled        = true
    statsLabel.Font              = Enum.Font.Gotham
    statsLabel.Parent            = btn

    -- Game Pass バッジ
    if vConfig.RequiresGamePass then
        local badge              = Instance.new("TextLabel")
        badge.Size               = UDim2.new(1, 0, 0, 20)
        badge.Position           = UDim2.new(0, 0, 1, -22)
        badge.BackgroundColor3   = Color3.fromRGB(200, 160, 0)
        badge.BackgroundTransparency = 0
        badge.Text               = "Game Pass 限定"
        badge.TextColor3         = Color3.fromRGB(0, 0, 0)
        badge.TextScaled         = true
        badge.Font               = Enum.Font.GothamBold
        badge.ZIndex             = 2
        badge.Parent             = btn

        local badgeCorner        = Instance.new("UICorner")
        badgeCorner.CornerRadius = UDim.new(0, 4)
        badgeCorner.Parent       = badge
    end

    -- ホバーエフェクト
    local originalColor = buttonColors[vType] or Color3.fromRGB(80, 80, 80)
    local hoverColor    = originalColor:Lerp(Color3.fromRGB(255, 255, 255), 0.15)

    btn.MouseEnter:Connect(function()
        TweenService:Create(btn, TweenInfo.new(0.12), { BackgroundColor3 = hoverColor }):Play()
    end)
    btn.MouseLeave:Connect(function()
        TweenService:Create(btn, TweenInfo.new(0.12), { BackgroundColor3 = originalColor }):Play()
    end)

    -- クリックで車種選択
    btn.MouseButton1Click:Connect(function()
        evSelectVehicle:FireServer(vType)
        -- フェードアウトして閉じる
        TweenService:Create(overlay, TweenInfo.new(0.3), { BackgroundTransparency = 1 }):Play()
        TweenService:Create(panel,   TweenInfo.new(0.3), { BackgroundTransparency = 1 }):Play()
        task.delay(0.35, function()
            screenGui:Destroy()
        end)
    end)
end
