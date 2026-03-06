-- CarController.lua
-- LocalScript: StarterPlayerScripts に配置
-- 車の操作・カメラ追従・ブースト・ドリフト・Eキーアビリティ・サイレン点滅

local Players           = game:GetService("Players")
local RunService        = game:GetService("RunService")
local UserInputService  = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Settings = require(ReplicatedStorage:WaitForChild("CarSettings"))

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

-- 車モデルとボディを取得（DeathmatchManager が生成するまで待機）
local car     = workspace:WaitForChild("PlayerCar_" .. player.UserId, 30)
local carBody = car and car:FindFirstChild("Body")

-- 車種設定（サーバーが StringValue "VehicleType" を車モデル内にセット）
local vehicleTypeValue = car and car:WaitForChild("VehicleType", 10)
local vehicleType      = vehicleTypeValue and vehicleTypeValue.Value or "Normal"
local vConfig          = Settings.Vehicles[vehicleType] or Settings.Vehicles.Normal

-- RemoteEvents
local remotes     = ReplicatedStorage:WaitForChild("DeathmatchRemotes", 30)
local evAbility   = remotes:WaitForChild("FireAbility",  10)
local evDriftCoin = remotes:WaitForChild("DriftCoin",    10)

-- ============================================================
-- 状態変数
-- ============================================================
local isBoosting    = false
local boostCooldown = false
local abilityCooldown = false   -- forward-declared, assigned below
local driftCoinTimer  = 0
local sirenTimer      = 0
local sirenLightOn    = true

local inputMap = {
    Forward  = false,
    Backward = false,
    Left     = false,
    Right    = false,
    Boost    = false,
    Drift    = false,
    Ability  = false,
}

local keyBindings = {
    [Enum.KeyCode.W]          = "Forward",
    [Enum.KeyCode.Up]         = "Forward",
    [Enum.KeyCode.S]          = "Backward",
    [Enum.KeyCode.Down]       = "Backward",
    [Enum.KeyCode.A]          = "Left",
    [Enum.KeyCode.Left]       = "Left",
    [Enum.KeyCode.D]          = "Right",
    [Enum.KeyCode.Right]      = "Right",
    [Enum.KeyCode.LeftShift]  = "Boost",
    [Enum.KeyCode.RightShift] = "Boost",
    [Enum.KeyCode.LeftAlt]    = "Drift",
    [Enum.KeyCode.RightAlt]   = "Drift",
    [Enum.KeyCode.E]          = "Ability",
}

-- ============================================================
-- ブースト処理
-- ============================================================
local function activateBoost()
    if isBoosting or boostCooldown then return end
    isBoosting = true
    task.delay(vConfig.BoostDuration, function()
        isBoosting    = false
        boostCooldown = true
        task.delay(vConfig.BoostCooldown, function()
            boostCooldown = false
        end)
    end)
end

-- ============================================================
-- アビリティ処理（E キー）
-- ============================================================
local activateAbility  -- 前方宣言

activateAbility = function()
    if abilityCooldown then return end
    abilityCooldown = true
    evAbility:FireServer(vehicleType)   -- サーバーに通知
    task.delay(vConfig.AbilityCooldown, function()
        abilityCooldown = false
    end)
end

-- ============================================================
-- 入力イベント
-- ============================================================
UserInputService.InputBegan:Connect(function(input, processed)
    if processed then return end
    local action = keyBindings[input.KeyCode]
    if not action then return end
    inputMap[action] = true
    if action == "Ability" then
        activateAbility()
    end
end)

UserInputService.InputEnded:Connect(function(input)
    local action = keyBindings[input.KeyCode]
    if action then
        inputMap[action] = false
    end
end)

-- ============================================================
-- サイレン・ライト点滅（特殊車両のみ）
-- ============================================================
if vConfig.HasSiren and car then
    local light1     = car:FindFirstChild("Light1", true)
    local light2     = car:FindFirstChild("Light2", true)
    local sirenSound = car:FindFirstChild("SirenSound", true)

    if sirenSound then sirenSound:Play() end

    RunService.Heartbeat:Connect(function(dt)
        sirenTimer += dt
        if sirenTimer >= 0.3 then
            sirenTimer   = 0
            sirenLightOn = not sirenLightOn
            if light1 then light1.Enabled = sirenLightOn end
            if light2 then light2.Enabled = not sirenLightOn end
        end
    end)
end

-- ============================================================
-- メインループ（移動・ドリフト・カメラ）
-- ============================================================
RunService.Heartbeat:Connect(function(dt)
    if not car or not carBody then return end

    -- ブーストキー
    if inputMap.Boost and not isBoosting and not boostCooldown then
        activateBoost()
    end

    local speedBoostFx  = car:GetAttribute("SpeedBoostFx") or 1  -- アイテム効果
    local currentMaxSpeed = (isBoosting
        and vConfig.MaxSpeed * vConfig.BoostMultiplier
        or  vConfig.MaxSpeed) * speedBoostFx

    local throttle = 0
    if inputMap.Forward  then throttle =  1 end
    if inputMap.Backward then throttle = -1 end

    local steer = 0
    if inputMap.Left  then steer = -1 end
    if inputMap.Right then steer  =  1 end

    local bv  = carBody:FindFirstChild("BodyVelocity")
    local bav = carBody:FindFirstChild("BodyAngularVelocity")

    if bv and bav then
        local forward = carBody.CFrame.LookVector

        -- ドリフト：横方向の速度を維持して滑る
        if inputMap.Drift then
            local lateralVel = bv.Velocity - forward * bv.Velocity:Dot(forward)
            bv.Velocity = forward * bv.Velocity:Dot(forward)
                        + lateralVel * Settings.DriftFriction
        end

        -- 前後加速・減速
        if throttle == 0 then
            local braking = vConfig.Acceleration / vConfig.MaxSpeed
            bv.Velocity = bv.Velocity * (1 - dt * braking * 2)
        else
            local currentSpeed = bv.Velocity.Magnitude
            if currentSpeed < currentMaxSpeed then
                bv.Velocity = bv.Velocity + forward * (throttle * vConfig.Acceleration * dt)
            end
            local targetVel = forward * (throttle * currentMaxSpeed)
            bv.Velocity = bv.Velocity:Lerp(targetVel, 1 - math.exp(-vConfig.Acceleration * dt))
        end

        -- ステアリング（走行中のみ）
        local speed = bv.Velocity.Magnitude
        local steerAmount = steer * vConfig.TurnSpeed * math.min(speed / 20, 1)
        bav.AngularVelocity = Vector3.new(0, -steerAmount, 0)
    end

    -- ドリフトコインタイマー
    if inputMap.Drift and bv and bv.Velocity.Magnitude > 10 then
        driftCoinTimer += dt
        if driftCoinTimer >= Settings.DriftCoinInterval then
            driftCoinTimer = 0
            evDriftCoin:FireServer(Settings.DriftCoinAmount)
        end
    else
        driftCoinTimer = 0
    end

    -- カメラ追従（スムーズ）
    local targetCF  = carBody.CFrame
    local camOffset = targetCF.LookVector * (-Settings.CameraDistance)
                    + Vector3.new(0, Settings.CameraHeight, 0)
    local camPos    = targetCF.Position + camOffset
    camera.CFrame   = camera.CFrame:Lerp(
        CFrame.new(camPos, targetCF.Position),
        1 - math.exp(-8 * dt)
    )
end)

-- ============================================================
-- 転倒検知（一定角度傾いたら自動リセット）
-- ============================================================
RunService.Heartbeat:Connect(function()
    if not carBody then return end
    local upVec = carBody.CFrame.UpVector
    local angle = math.deg(math.acos(math.clamp(upVec:Dot(Vector3.new(0, 1, 0)), -1, 1)))
    if angle > Settings.FlipThreshold then
        task.wait(Settings.FlipTimer)
        upVec = carBody.CFrame.UpVector
        angle = math.deg(math.acos(math.clamp(upVec:Dot(Vector3.new(0, 1, 0)), -1, 1)))
        if angle > Settings.FlipThreshold then
            carBody.CFrame      = carBody.CFrame * CFrame.new(0, 3, 0) * CFrame.Angles(0, 0, 0)
            carBody.Velocity    = Vector3.zero
            carBody.RotVelocity = Vector3.zero
        end
    end
end)
