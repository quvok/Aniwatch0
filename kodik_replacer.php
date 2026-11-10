<?php

/*
=====================================================
 Kodik Replacer - protecting your players
-----------------------------------------------------
 Using proxy: create file engine/data/kodik_replacer_proxy.txt
 Put example content: 
 
with type
socks5://193.31.100.176:9690
OR with basic auth
socks5://admin:pass@193.31.100.176:9690
OR with cookie data
socks5://admin:pass@193.31.100.176:9690|login=admin;password=123456

-----------------------------------------------------

http://
HTTP Proxy. Default when no scheme or proxy type is specified.

https://
HTTPS Proxy. (Added in 7.52.0 for OpenSSL, GnuTLS and NSS)

socks4://
SOCKS4 Proxy.

socks4a://
SOCKS4a Proxy. Proxy resolves URL hostname.

socks5://
SOCKS5 Proxy.

socks5h://
SOCKS5 Proxy. Proxy resolves URL hostname.
-----------------------------------------------------
 Made by rdn-team.com, skype rdn-team.com
-----------------------------------------------------

=====================================================
*/

if( !defined('DATALIFEENGINE') ) {
    header( "HTTP/1.1 403 Forbidden" );
    die( "Hacking attempt!" );
}

@header("Content-Type: text/plain; charset=UTF-8");
@header("X-Robots-Tag: noindex");
@header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

@error_reporting( E_ALL & ~E_WARNING & ~E_DEPRECATED & ~E_NOTICE );
@ini_set( 'display_errors', false );
@ini_set( 'html_errors', false );

ignore_user_abort(true);

if( !function_exists('kodik_replacer_lock') ) {
    function kodik_replacer_lock($operation = '') {
        $operation = preg_replace('/[^a-z0-9_\-]/i', '', (string)$operation);
        $lockFile = ENGINE_DIR . "/data/kodik_{$operation}.txt";
        $lockFp = @fopen($lockFile, 'c');

        if( !$lockFp ) {
            return true;
        }

        if( !@flock($lockFp, LOCK_EX | LOCK_NB) ) {
            @fclose($lockFp);
            return true;
        }

        @chmod( $lockFile, 0666 );

        register_shutdown_function(function() use ($lockFp, $lockFile) {
            @flock($lockFp, LOCK_UN);
            @fclose($lockFp);
            @unlink($lockFile);
        });

        return false;
    }
}

if( !function_exists('kodik_replacer_normalize_payload') ) {
    function kodik_replacer_normalize_payload($payload, $default_interval = 10) {
        if( !is_array($payload) || !isset($payload['replace']) || !is_array($payload['replace']) ) {
            return false;
        }

        $replace = $payload['replace'];
        $from = isset($replace['from']) ? $replace['from'] : array();
        $to = isset($replace['to']) ? $replace['to'] : array();

        if( !is_array($from) || !is_array($to) ) {
            return false;
        }

        $from = array_values($from);
        $to = array_values($to);

        if( count($from) !== count($to) ) {
            return false;
        }

        $normalized_from = array();
        $normalized_to = array();

        foreach( $from as $index => $search ) {
            if( !is_scalar($search) ) {
                continue;
            }

            $search = (string)$search;

            if( $search === '' ) {
                continue;
            }

            $replace_with = isset($to[$index]) && is_scalar($to[$index]) ? (string)$to[$index] : '';
            $normalized_from[] = $search;
            $normalized_to[] = $replace_with;
        }

        $interval = isset($replace['interval']) ? intval($replace['interval']) : intval($default_interval);

        if( $interval <= 0 ) {
            $interval = intval($default_interval);
        }

        if( $interval <= 0 ) {
            $interval = 10;
        }

        $payload['replace']['from'] = $normalized_from;
        $payload['replace']['to'] = $normalized_to;
        $payload['replace']['interval'] = $interval;

        return $payload;
    }
}

if( !function_exists('kodik_replacer_get_interval') ) {
    function kodik_replacer_get_interval($payload, $default_interval = 10) {
        if( is_array($payload) && isset($payload['replace']) && is_array($payload['replace']) && isset($payload['replace']['interval']) ) {
            $interval = intval($payload['replace']['interval']);

            if( $interval > 0 ) {
                return $interval;
            }
        }

        return $default_interval;
    }
}

if( !function_exists('kodik_replacer_host_for_query') ) {
    function kodik_replacer_host_for_query() {
        $host = isset($_SERVER['HTTP_HOST']) ? trim((string)$_SERVER['HTTP_HOST']) : '';
        $host = preg_replace('/[\r\n\t\s]/', '', $host);
        $host = preg_replace('/:\d+$/', '', $host);

        return rawurlencode($host);
    }
}

if( !function_exists('kodik_replacer_save_payload') ) {
    function kodik_replacer_save_payload($file, $payload) {
        $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

        if( defined('JSON_INVALID_UTF8_SUBSTITUTE') ) {
            $flags |= JSON_INVALID_UTF8_SUBSTITUTE;
        }

        $result = @file_put_contents($file, json_encode($payload, $flags), LOCK_EX);

        if( $result !== false ) {
            @chmod($file, 0666);
            return true;
        }

        return false;
    }
}

if( !function_exists('kodik_replacer_update_blocklist') ) {
    function kodik_replacer_update_blocklist() {
        if( kodik_replacer_lock('processing') ) {
            echo 'Update in progress';
            return false;
        }

        $kfile = ENGINE_DIR . '/data/kodik_replace.txt';
        $kodik_data = @file_get_contents($kfile);
        $upd_interval = 10;
        $last_list = false;
        $kodik_arr = false;
        $curl_debug = array();
        $last_qerr = '';
        $infoe = '';

        if( $kodik_data !== false ) {
            $last_list = @filemtime($kfile);
            $kodik_arr = @json_decode($kodik_data, true);
            $upd_interval = kodik_replacer_get_interval($kodik_arr, $upd_interval);
        }

        if( !$last_list || ($last_list + ($upd_interval * 60)) < time() ) {
            $data = false;
            $r_file = 'https://domain.get-video-domain.com/domain/replace_v2.json?domain=' . kodik_replacer_host_for_query();
            $data_proxy = @file_get_contents( ENGINE_DIR . '/data/kodik_replacer_proxy.txt' );

            if( function_exists('curl_init') ) {
                $ch = curl_init();

                curl_setopt( $ch, CURLOPT_URL, $r_file );
                @curl_setopt( $ch, CURLOPT_FOLLOWLOCATION, 1 );

                if( $data_proxy !== false ) {
                    $p_list = array_values(array_filter(array_map('trim', explode("\n", $data_proxy)), 'strlen'));

                    if( count($p_list) > 0 ) {
                        $p_item = $p_list[mt_rand(0, count($p_list) - 1)];
                        $p_arr = explode('|', $p_item, 2);

                        if( isset($p_arr[0]) && $p_arr[0] !== '' ) {
                            curl_setopt($ch, CURLOPT_PROXY, $p_arr[0]);
                        }

                        if( isset($p_arr[1]) && $p_arr[1] !== '' ) {
                            curl_setopt($ch, CURLOPT_COOKIE, $p_arr[1]);
                        }
                    }
                }

                curl_setopt( $ch, CURLOPT_RETURNTRANSFER, 1 );
                curl_setopt( $ch, CURLOPT_CONNECTTIMEOUT, 5 );
                curl_setopt( $ch, CURLOPT_TIMEOUT, 10 );
                curl_setopt( $ch, CURLOPT_SSL_VERIFYPEER, true );
                curl_setopt( $ch, CURLOPT_SSL_VERIFYHOST, 2 );
                curl_setopt( $ch, CURLOPT_FAILONERROR, true );
                curl_setopt( $ch, CURLOPT_HEADER, 0 );
                curl_setopt( $ch, CURLOPT_ENCODING, '' );
                curl_setopt( $ch, CURLOPT_MAXREDIRS, 2 );
                curl_setopt( $ch, CURLOPT_USERAGENT, 'Kodik Replacer DLE19' );

                $data = curl_exec($ch);
                $curl_debug = curl_getinfo($ch);

                if( @curl_errno($ch) ) {
                    $last_qerr = @curl_error($ch);
                }

                curl_close($ch);

            } elseif( preg_match('/1|yes|on|true/i', (string)ini_get('allow_url_fopen')) ) {

                $options = stream_context_create(array(
                    'http' => array(
                        'timeout' => 10,
                        'header' => "User-Agent: Kodik Replacer DLE19\r\n"
                    ),
                    'ssl' => array(
                        'verify_peer' => true,
                        'verify_peer_name' => true
                    )
                ));

                $data = @file_get_contents($r_file, false, $options);
            }

            if( $data !== false && is_string($data) && $data !== '' ) {
                $output = @json_decode($data, true);
                $output = kodik_replacer_normalize_payload($output, $upd_interval);

                if( $output !== false ) {
                    kodik_replacer_save_payload($kfile, $output);
                } else {
                    if( !is_array($kodik_arr) || !isset($kodik_arr['replace']) || !is_array($kodik_arr['replace']) ) {
                        kodik_replacer_save_payload($kfile, array('failed' => 'invalid replace data'));
                    } else {
                        $kodik_arr['replace']['interval'] = 10;
                        $cached_payload = kodik_replacer_normalize_payload($kodik_arr, 10);

                        if( $cached_payload !== false ) {
                            kodik_replacer_save_payload($kfile, $cached_payload);
                        } else {
                            kodik_replacer_save_payload($kfile, array('failed' => 'invalid cached replace data'));
                        }
                    }
                }

            } else {

                if( is_array($curl_debug) ) {
                    foreach( $curl_debug as $field => $error_data ) {
                        if( is_scalar($error_data) ) {
                            $infoe .= ', [' . $field . '] : ' . $error_data;
                        }
                    }
                }

                if( $last_qerr !== '' ) {
                    $infoe .= ', [error] : ' . $last_qerr;
                }

                if( !is_array($kodik_arr) || !isset($kodik_arr['replace']) || !is_array($kodik_arr['replace']) ) {
                    kodik_replacer_save_payload($kfile, array('failed' => 'last query failed: ' . $infoe));
                } else {
                    $kodik_arr['replace']['interval'] = 10;
                    $cached_payload = kodik_replacer_normalize_payload($kodik_arr, 10);

                    if( $cached_payload !== false ) {
                        kodik_replacer_save_payload($kfile, $cached_payload);
                    } else {
                        kodik_replacer_save_payload($kfile, array('failed' => 'invalid cached replace data'));
                    }
                }
            }

            echo 'Update completed';

        } else {
            echo 'Update not required';
        }

        return true;
    }
}

kodik_replacer_update_blocklist();

?>
