package com.luneng.smartstore.customer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "customer_user")
public class CustomerUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 128)
    private String openid;

    @Column(length = 80)
    private String nickname;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "pickup_name", length = 40)
    private String pickupName;

    @Column(length = 20)
    private String phone;

    @Column(nullable = false)
    private boolean enabled;

    protected CustomerUser() {
    }

    public CustomerUser(String openid) {
        this.openid = openid;
        this.enabled = true;
    }

    public void updateProfile(String pickupName, String phone) {
        this.pickupName = pickupName;
        this.phone = phone;
    }

    public void deactivate(String tombstoneOpenid) {
        this.openid = tombstoneOpenid;
        this.nickname = null;
        this.avatarUrl = null;
        this.pickupName = null;
        this.phone = null;
        this.enabled = false;
    }

    public Long getId() {
        return id;
    }

    public String getOpenid() {
        return openid;
    }

    public String getNickname() {
        return nickname;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public String getPickupName() {
        return pickupName;
    }

    public String getPhone() {
        return phone;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean profileComplete() {
        return pickupName != null && !pickupName.isBlank() && phone != null && !phone.isBlank();
    }
}
