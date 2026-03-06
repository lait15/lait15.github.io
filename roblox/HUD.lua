-- HUD.lua
-- LocalScript: StarterGui に配置
-- デスマッチHUD（HPバー・コイン・キルフィード・アビリティクールダウン・アイテム通知）

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService        = game:GetService("RunService")
local TweenService      = game:GetService("TweenService")

local player   = Players.LocalPlayer
local gui      = player:WaitForChild("PlayerGui")

local remotes    = ReplicatedStorage:WaitForChild("DeathmatchRemotes", 30)
local evUpdateHP = remotes:WaitForChild("UpdateHP",       10)
local evKilled   = remotes:WaitForChild("PlayerKilled",   10)
local evItem     = remotes:WaitForChild("ItemEffect",     10)

-- ============================================================
-- ScreenGui
-- ============================================================
local screenGui              = Instance.new("ScreenGui")
screenGui.Name               = "DeathmatchHUD"
screenGui.ResetOnSpawn       = false
screenGui.IgnoreGuiInset     = true
screenGui.Parent             = gui

local function corner(parent, radius)
    local c = Instance.new("UICorner")
    c.CornerRadius = UDim.new(0, radius or 6)
    c.Parent       = parent
    return c
end

-- ============================================================
-- HPバー（左下）
-- ============================================================
local hpContainer            = Instance.new("Frame")
hpContainer.Size             = UDim2.fromOffset(280, 44)
hpContainer.Position         = UDim2.new(0, 16, 1, -60)
hpContainer.BackgroundTransparency = 1
hpContainer.Parent           = screenGui

local hpLabel                = Instance.new("TextLabel")
hpLabel.Size                 = UDim2.fromOffset(40, 20)
hpLabel.Position             = UDim2.fromOffset(0, 0)
hpLabel.BackgroundTransparency = 1
hpLabel.Text                 = "HP"
hpLabel.TextColor3           = Color3.fromRGB(200, 200, 200)
hpLabel.TextScaled           = true
hpLabel.Font                 = Enum.Font.GothamBold
hpLabel.Parent               = hpContainer

local hpNumLabel             = Instance.new("TextLabel")
hpNumLabel.Size              = UDim2.fromOffset(80, 20)
hpNumLabel.Position          = UDim2.new(1, -80, 0, 0)
hpNumLabel.BackgroundTransparency = 1
hpNumLabel.Text              = "100 / 100"
hpNumLabel.TextColor3        = Color3.fromRGB(200, 200, 200)
hpNumLabel.TextScaled        = true
hpNumLabel.Font              = Enum.Font.Gotham
hpNumLabel.TextXAlignment    = Enum.TextXAlignment.Right
hpNumLabel.Parent            = hpContainer

local hpBg                   = Instance.new("Frame")
hpBg.Size                    = UDim2.new(1, 0, 0, 18)
hpBg.Position                = UDim2.fromOffset(0, 24)
hpBg.BackgroundColor3        = Color3.fromRGB(50, 50, 50)
hpBg.BorderSizePixel         = 0
hpBg.Parent                  = hpContainer
corner(hpBg, 4)

local hpBar                  = Instance.new("Frame")
hpBar.Size                   = UDim2.fromScale(1, 1)
hpBar.BackgroundColor3       = Color3.fromRGB(50, 200, 70)
hpBar.BorderSizePixel        = 0
hpBar.Parent                 = hpBg
corner(hpBar, 4)

evUpdateHP.OnClientEvent:Connect(function(hp, maxHP)
    local ratio = math.max(0, hp / maxHP)
    TweenService:Create(hpBar, TweenInfo.new(0.2), {
        Size = UDim2.new(ratio, 0, 1, 0),
    }):Play()
    hpNumLabel.Text = hp .. " / " .. maxHP

    if ratio > 0.5 then
        hpBar.BackgroundColor3 = Color3.fromRGB(50, 200, 70)
    elseif ratio > 0.25 then
        hpBar.BackgroundColor3 = Color3.fromRGB(220, 175, 30)
    else
        hpBar.BackgroundColor3 = Color3.fromRGB(220, 50, 50)
    end
end)

-- ============================================================
-- コイン表示（右上）
-- ============================================================
local coinFrame              = Instance.new("Frame")
coinFrame.Size               = UDim2.fromOffset(160, 36)
coinFrame.Position           = UDim2.new(1, -176, 0, 12)
coinFrame.BackgroundColor3   = Color3.fromRGB(30, 30, 30)
coinFrame.BackgroundTransparency = 0.3
coinFrame.BorderSizePixel    = 0
coinFrame.Parent             = screenGui
corner(coinFrame, 8)

local coinLabel              = Instance.new("TextLabel")
coinLabel.Size               = UDim2.fromScale(1, 1)
coinLabel.BackgroundTransparency = 1
coinLabel.Text               = "コイン: 0"
coinLabel.TextColor3         = Color3.fromRGB(255, 215, 0)
coinLabel.TextScaled         = true
coinLabel.Font               = Enum.Font.GothamBold
coinLabel.Parent             = coinFrame

-- Leaderstats からコイン数を取得して表示
RunService.Heartbeat:Connect(function()
    local ls = player:FindFirstChild("leaderstats")
    if ls and ls:FindFirstChild("Coins") then
        coinLabel.Text = "コイン: " .. ls.Coins.Value
    end
end)

-- ============================================================
-- スコア表示（右上・コインの下）
-- ============================================================
local scoreFrame             = Instance.new("Frame")
scoreFrame.Size              = UDim2.fromOffset(160, 36)
scoreFrame.Position          = UDim2.new(1, -176, 0, 54)
scoreFrame.BackgroundColor3  = Color3.fromRGB(30, 30, 30)
scoreFrame.BackgroundTransparency = 0.3
scoreFrame.BorderSizePixel   = 0
scoreFrame.Parent            = screenGui
corner(scoreFrame, 8)

local scoreLabel             = Instance.new("TextLabel")
scoreLabel.Size              = UDim2.fromScale(1, 1)
scoreLabel.BackgroundTransparency = 1
scoreLabel.Text              = "Kill: 0  Death: 0"
scoreLabel.TextColor3        = Color3.fromRGB(200, 200, 200)
scoreLabel.TextScaled        = true
scoreLabel.Font              = Enum.Font.Gotham
scoreLabel.Parent            = scoreFrame

RunService.Heartbeat:Connect(function()
    local ls = player:FindFirstChild("leaderstats")
    if ls then
        local k = ls:FindFirstChild("Kills")
        local d = ls:FindFirstChild("Deaths")
        if k and d then
            scoreLabel.Text = "Kill: " .. k.Value .. "  Death: " .. d.Value
        end
    end
end)

-- ============================================================
-- キルフィード（中央上）
-- ============================================================
local killFeedLabel              = Instance.new("TextLabel")
killFeedLabel.Size               = UDim2.fromOffset(400, 30)
killFeedLabel.Position           = UDim2.new(0.5, -200, 0, 12)
killFeedLabel.BackgroundTransparency = 1
killFeedLabel.Text               = ""
killFeedLabel.TextColor3         = Color3.fromRGB(255, 220, 50)
killFeedLabel.TextScaled         = true
killFeedLabel.Font               = Enum.Font.GothamBold
killFeedLabel.Parent             = screenGui

evKilled.OnClientEvent:Connect(function(killerName, victimName)
    killFeedLabel.Text = killerName .. " が " .. victimName .. " を撃破！"
    killFeedLabel.TextTransparency = 0
    task.delay(3, function()
        TweenService:Create(killFeedLabel, TweenInfo.new(0.5), {
            TextTransparency = 1
        }):Play()
    end)
end)

-- ============================================================
-- アイテム取得通知（中央下寄り）
-- ============================================================
local itemNotif              = Instance.new("Frame")
itemNotif.Size               = UDim2.fromOffset(260, 34)
itemNotif.Position           = UDim2.new(0.5, -130, 1, -110)
itemNotif.BackgroundColor3   = Color3.fromRGB(30, 100, 160)
itemNotif.BackgroundTransparency = 0.2
itemNotif.BorderSizePixel    = 0
itemNotif.Visible            = false
itemNotif.Parent             = screenGui
corner(itemNotif, 8)

local itemNotifLabel         = Instance.new("TextLabel")
itemNotifLabel.Size          = UDim2.fromScale(1, 1)
itemNotifLabel.BackgroundTransparency = 1
itemNotifLabel.TextColor3    = Color3.fromRGB(255, 255, 255)
itemNotifLabel.TextScaled    = true
itemNotifLabel.Font          = Enum.Font.GothamBold
itemNotifLabel.Parent        = itemNotif

local effectNames = {
    speed  = "スピードアップ！",
    shield = "シールド発動！",
    aoe    = "爆弾炸裂！",
}

evItem.OnClientEvent:Connect(function(itemName, itemConfig)
    itemNotifLabel.Text = itemName .. ": " .. (effectNames[itemConfig.effect] or "効果発動！")
    itemNotif.Visible   = true
    task.delay(2.5, function()
        TweenService:Create(itemNotif, TweenInfo.new(0.3), {
            BackgroundTransparency = 1
        }):Play()
        TweenService:Create(itemNotifLabel, TweenInfo.new(0.3), {
            TextTransparency = 1
        }):Play()
        task.delay(0.35, function()
            itemNotif.Visible                = false
            itemNotif.BackgroundTransparency  = 0.2
            itemNotifLabel.TextTransparency   = 0
        end)
    end)
end)
