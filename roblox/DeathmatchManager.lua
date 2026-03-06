-- DeathmatchManager.lua
-- Script: ServerScriptService に配置
-- デスマッチ全体の管理（車生成・HP・衝突ダメージ・アビリティ・リスポーン・コイン・アイテム）

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Settings = require(ReplicatedStorage:WaitForChild("CarSettings"))

-- ============================================================
-- RemoteEvents フォルダ作成
-- ============================================================
local remotes      = Instance.new("Folder")
remotes.Name       = "DeathmatchRemotes"
remotes.Parent     = ReplicatedStorage

local function makeRemote(name)
    local r    = Instance.new("RemoteEvent")
    r.Name     = name
    r.Parent   = remotes
    return r
end

local evSelectVehicle = makeRemote("SelectVehicle")
local evFireAbility   = makeRemote("FireAbility")
local evUpdateHP      = makeRemote("UpdateHP")
local evPlayerKilled  = makeRemote("PlayerKilled")
local evDriftCoin     = makeRemote("DriftCoin")
local evItemEffect    = makeRemote("ItemEffect")

-- ============================================================
-- プレイヤーデータ
-- { vehicleType, hp, car, isAlive, activeEffects={} }
-- ============================================================
local playerData = {}

-- ============================================================
-- 前方宣言
-- ============================================================
local applyDamage
local killPlayer

-- ============================================================
-- 車の生成
-- CarTemplate は ReplicatedStorage に置いた車モデル
-- （Body という PrimaryPart, 必要に応じて Light1/Light2/SirenSound を子に持つ）
-- ============================================================
local carTemplate = ReplicatedStorage:WaitForChild("CarTemplate", 30)

local function getSpawnCFrame()
    local spawns = workspace:FindFirstChild("Spawns")
    if spawns then
        local list = spawns:GetChildren()
        if #list > 0 then
            local sp = list[math.random(1, #list)]
            return sp.CFrame * CFrame.new(0, 3, 0)
        end
    end
    return CFrame.new(math.random(-50, 50), 5, math.random(-50, 50))
end

local function spawnCar(player, vehicleType)
    local data    = playerData[player]
    if not data then return end

    local vConfig = Settings.Vehicles[vehicleType] or Settings.Vehicles.Normal

    -- 既存の車を削除
    if data.car then
        data.car:Destroy()
        data.car = nil
    end

    -- テンプレートから複製
    local newCar  = carTemplate:Clone()
    newCar.Name   = "PlayerCar_" .. player.UserId
    newCar.Parent = workspace

    -- 車種タイプを格納（CarController.lua が参照）
    local vTypeVal        = Instance.new("StringValue")
    vTypeVal.Name         = "VehicleType"
    vTypeVal.Value        = vehicleType
    vTypeVal.Parent       = newCar

    -- 色をセット
    for _, part in ipairs(newCar:GetDescendants()) do
        if part:IsA("BasePart") and part.Name ~= "Window" then
            part.BrickColor = BrickColor.new(vConfig.Color)
        end
    end

    -- スポーン位置
    local body = newCar:FindFirstChild("Body")
    if body then
        body.CFrame = getSpawnCFrame()
    end

    -- データ更新
    data.car           = newCar
    data.hp            = vConfig.HP
    data.isAlive       = true
    data.vehicleType   = vehicleType
    data.activeEffects = {}

    evUpdateHP:FireClient(player, data.hp, vConfig.HP)

    -- 衝突ダメージ検知
    if body then
        body.Touched:Connect(function(hit)
            if not data.isAlive then return end

            -- 相手の車を探す
            local hitPlayer = nil
            for p, d in pairs(playerData) do
                if d.car and d.car:FindFirstChild("Body") == hit then
                    hitPlayer = p
                    break
                end
            end
            if not hitPlayer or hitPlayer == player then return end

            -- 速度差でダメージ計算
            local mySpeed   = body.Velocity.Magnitude
            local hitSpeed  = hit.Velocity.Magnitude
            local speedDiff = math.abs(mySpeed - hitSpeed)

            if speedDiff >= Settings.CollisionSpeedThreshold then
                local damage = math.floor(speedDiff * Settings.CollisionDamageMultiplier)
                applyDamage(player, hitPlayer, damage)
            end
        end)
    end
end

-- ============================================================
-- ダメージ処理
-- ============================================================
applyDamage = function(attacker, victim, damage)
    local d = playerData[victim]
    if not d or not d.isAlive then return end

    -- シールド軽減
    if d.activeEffects.shield then
        damage = math.floor(damage * (1 - d.activeEffects.shield))
    end

    -- スロー中の車はダメージが通りやすい（バランス調整）
    if d.activeEffects.slow then
        damage = math.floor(damage * 1.2)
    end

    d.hp = math.max(0, d.hp - damage)
    local vConfig = Settings.Vehicles[d.vehicleType] or Settings.Vehicles.Normal
    evUpdateHP:FireClient(victim, d.hp, vConfig.HP)

    if d.hp <= 0 then
        killPlayer(attacker, victim)
    end
end

-- ============================================================
-- キル・爆発・リスポーン
-- ============================================================
killPlayer = function(killer, victim)
    local victimData = playerData[victim]
    if not victimData or not victimData.isAlive then return end
    victimData.isAlive = false

    -- キラーのキル数・コイン加算
    local killerData = playerData[killer]
    if killerData then
        local ls = killer:FindFirstChild("leaderstats")
        if ls then
            ls.Kills.Value += 1
            local coinGain = Settings.KillCoin
            if killer:GetAttribute("hasDoubleCoin") then
                coinGain = coinGain * 2
            end
            ls.Coins.Value += coinGain
        end
    end

    -- ビクティムのデス加算
    local ls = victim:FindFirstChild("leaderstats")
    if ls then ls.Deaths.Value += 1 end

    evPlayerKilled:FireAllClients(killer.Name, victim.Name)

    -- 爆発エフェクト
    if victimData.car then
        local body = victimData.car:FindFirstChild("Body")
        if body then
            local explosion            = Instance.new("Explosion")
            explosion.Position         = body.Position
            explosion.BlastRadius      = 10
            explosion.BlastPressure    = 0   -- 吹き飛ばしなし
            explosion.Parent           = workspace
        end
        victimData.car:Destroy()
        victimData.car = nil
    end

    -- リスポーン
    local savedType = victimData.vehicleType
    task.delay(Settings.RespawnDelay, function()
        if playerData[victim] then
            spawnCar(victim, savedType)
        end
    end)
end

-- ============================================================
-- アビリティ処理
-- ============================================================
local function handleAbility(player, vehicleType)
    local data    = playerData[player]
    if not data or not data.isAlive then return end

    local vConfig = Settings.Vehicles[vehicleType] or Settings.Vehicles.Normal

    if vConfig.Ability == "EMP" then
        -- EMP: 周囲の車を一時停止
        local myBody = data.car and data.car:FindFirstChild("Body")
        if not myBody then return end

        for otherPlayer, otherData in pairs(playerData) do
            if otherPlayer == player or not otherData.isAlive or not otherData.car then continue end
            local otherBody = otherData.car:FindFirstChild("Body")
            if not otherBody then continue end

            local dist = (myBody.Position - otherBody.Position).Magnitude
            if dist <= vConfig.EMPRadius then
                local bv = otherBody:FindFirstChild("BodyVelocity")
                if bv then
                    bv.Velocity = Vector3.zero
                    -- EMPDuration 後に制御を返す（BodyVelocity の MaxForce を一時的に下げる方法もある）
                    local savedMaxForce = bv.MaxForce
                    bv.MaxForce = Vector3.new(1e5, 0, 1e5)
                    task.delay(vConfig.EMPDuration, function()
                        bv.MaxForce = savedMaxForce
                    end)
                end
            end
        end

    elseif vConfig.Ability == "Heal" then
        -- Heal: 自分の HP を回復
        local maxHP = vConfig.HP
        data.hp = math.min(maxHP, data.hp + vConfig.HealAmount)
        evUpdateHP:FireClient(player, data.hp, maxHP)

    elseif vConfig.Ability == "Water" then
        -- Water: 前方範囲にスロー＋ダメージ
        local myBody = data.car and data.car:FindFirstChild("Body")
        if not myBody then return end

        for otherPlayer, otherData in pairs(playerData) do
            if otherPlayer == player or not otherData.isAlive or not otherData.car then continue end
            local otherBody = otherData.car:FindFirstChild("Body")
            if not otherBody then continue end

            local toTarget = otherBody.Position - myBody.Position
            local dist     = toTarget.Magnitude
            if dist > vConfig.WaterRange then continue end

            local dot = toTarget.Unit:Dot(myBody.CFrame.LookVector)
            if dot < 0.3 then continue end  -- 前方約72度以内のみ

            applyDamage(player, otherPlayer, vConfig.WaterDamage)

            -- スロー効果をアクティブエフェクトに記録
            otherData.activeEffects.slow = vConfig.WaterSlowAmount
            task.delay(vConfig.WaterDuration, function()
                if playerData[otherPlayer] then
                    playerData[otherPlayer].activeEffects.slow = nil
                end
            end)
        end

    end
    -- "Boost" はクライアント側 CarController.lua で処理
end

evFireAbility.OnServerEvent:Connect(handleAbility)

-- ============================================================
-- ドリフトコイン付与
-- ============================================================
evDriftCoin.OnServerEvent:Connect(function(player, amount)
    local ls = player:FindFirstChild("leaderstats")
    if ls and ls:FindFirstChild("Coins") then
        local coinGain = amount
        if player:GetAttribute("hasDoubleCoin") then
            coinGain = coinGain * 2
        end
        ls.Coins.Value += coinGain
    end
end)

-- ============================================================
-- 車種選択（VehicleSelectGui からの通知）
-- ============================================================
evSelectVehicle.OnServerEvent:Connect(function(player, vehicleType)
    local data    = playerData[player]
    if not data then return end

    local vConfig = Settings.Vehicles[vehicleType]
    if not vConfig then return end

    -- Game Pass が必要な車種チェック
    if vConfig.RequiresGamePass then
        if not player:GetAttribute(vConfig.RequiresGamePass) then return end
    end

    spawnCar(player, vehicleType)
end)

-- ============================================================
-- パワーアップアイテムのスポーン
-- ============================================================
local function spawnOneItem()
    local itemNames = {}
    for name in pairs(Settings.Items) do
        table.insert(itemNames, name)
    end

    local itemName   = itemNames[math.random(1, #itemNames)]
    local itemConfig = Settings.Items[itemName]

    local part           = Instance.new("Part")
    part.Name            = "Item_" .. itemName
    part.Size            = Vector3.new(3, 1, 3)
    part.Anchored        = true
    part.BrickColor      = BrickColor.new("Bright yellow")
    part.CFrame          = CFrame.new(math.random(-80, 80), 1, math.random(-80, 80))
    part.Parent          = workspace

    local touched = false
    part.Touched:Connect(function(hit)
        if touched then return end

        -- プレイヤーの車か確認
        local touchedPlayer = nil
        for p, d in pairs(playerData) do
            if d.car and d.car:FindFirstChild("Body") == hit then
                touchedPlayer = p
                break
            end
        end
        if not touchedPlayer then return end

        touched = true
        part:Destroy()

        evItemEffect:FireClient(touchedPlayer, itemName, itemConfig)

        -- サーバー側でエフェクトを適用
        local d = playerData[touchedPlayer]
        if d then
            if itemConfig.effect == "speed" then
                touchedPlayer:SetAttribute("SpeedBoostFx", itemConfig.multiplier)
                -- CarController 側が Attribute を参照して速度倍率に使う
                task.delay(itemConfig.duration, function()
                    touchedPlayer:SetAttribute("SpeedBoostFx", nil)
                end)

            elseif itemConfig.effect == "shield" then
                d.activeEffects.shield = itemConfig.damageBlock
                task.delay(itemConfig.duration, function()
                    if playerData[touchedPlayer] then
                        playerData[touchedPlayer].activeEffects.shield = nil
                    end
                end)

            elseif itemConfig.effect == "aoe" then
                local myBody = d.car and d.car:FindFirstChild("Body")
                if myBody then
                    local pos = myBody.Position
                    local explosion            = Instance.new("Explosion")
                    explosion.Position         = pos
                    explosion.BlastRadius      = itemConfig.radius
                    explosion.BlastPressure    = 0
                    explosion.Parent           = workspace

                    for otherP, otherD in pairs(playerData) do
                        if otherP == touchedPlayer then continue end
                        local oCar = otherD.car
                        if oCar and oCar:FindFirstChild("Body") then
                            if (oCar.Body.Position - pos).Magnitude <= itemConfig.radius then
                                applyDamage(touchedPlayer, otherP, itemConfig.damage)
                            end
                        end
                    end
                end
            end
        end

        -- 一定時間後に再スポーン
        task.delay(Settings.ItemRespawnDelay, spawnOneItem)
    end)
end

local function spawnItems()
    for _ = 1, Settings.ItemSpawnCount do
        task.spawn(spawnOneItem)
    end
end

-- ============================================================
-- マップ選択（ランダム）
-- ============================================================
local function selectMap()
    local mapName    = Settings.Maps[math.random(1, #Settings.Maps)]
    local mapsFolder = workspace:FindFirstChild("Maps")
    if not mapsFolder then return end

    -- 選択されたマップだけを表示し、他を非表示
    for _, mapFolder in ipairs(mapsFolder:GetChildren()) do
        local visible = (mapFolder.Name == mapName)
        for _, part in ipairs(mapFolder:GetDescendants()) do
            if part:IsA("BasePart") then
                part.Transparency = visible and 0 or 1
                part.CanCollide   = visible
            end
        end
    end
end

-- ============================================================
-- プレイヤー参加・退出
-- ============================================================
Players.PlayerAdded:Connect(function(player)
    -- Leaderstats
    local ls      = Instance.new("Folder")
    ls.Name       = "leaderstats"
    ls.Parent     = player

    local function makeStat(name)
        local v       = Instance.new("IntValue")
        v.Name        = name
        v.Value       = 0
        v.Parent      = ls
        return v
    end

    makeStat("Kills")
    makeStat("Deaths")
    makeStat("Coins")

    playerData[player] = {
        vehicleType   = "Normal",
        hp            = 100,
        car           = nil,
        isAlive       = false,
        activeEffects = {},
    }

    -- キャラ追加後、VehicleSelectGui が SelectVehicle を送るまで待機
    player.CharacterAdded:Connect(function()
        -- GUI側からの通知を待つ（何もしない）
    end)
end)

Players.PlayerRemoving:Connect(function(player)
    local data = playerData[player]
    if data and data.car then
        data.car:Destroy()
    end
    playerData[player] = nil
end)

-- ============================================================
-- ゲーム開始時の初期化
-- ============================================================
selectMap()
task.delay(5, spawnItems)
